import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'

export const newOrderNumber = () => `OSR-${new Date().getFullYear()}-${randomUUID()}`

export function orderRecord({ orderNumber, form, totals, userId, provider }) {
  return {
    order_number: orderNumber, customer_email: form.email, user_id: userId || null,
    subtotal_gbp: totals.subtotal, shipping_gbp: totals.shipping,
    discount_gbp: totals.discount || '0.00', total_gbp: totals.total,
    shipping_name: `${form.firstName} ${form.lastName}`, shipping_line1: form.line1,
    shipping_line2: form.line2 || null, shipping_city: form.city,
    shipping_postcode: form.postcode || '', shipping_country: form.country,
    phone: form.phone ? `${form.dialCode || ''} ${form.phone}`.trim() : null,
    payment_method: provider, couponCode: totals.couponCode || '',
  }
}

export async function prepareOrder(order, items) {
  const { data, error } = await supabaseAdmin.rpc('prepare_payment_checkout', { p_order: order, p_items: items })
  if (error) throw error
  if (!data?.id) throw new Error('Checkout was not saved')
  return data
}

export async function recordPayment({ provider, paymentId, orderNumber, amountPence, currency, evidence }) {
  if (!Number.isSafeInteger(amountPence) || amountPence <= 0) throw new Error('Invalid captured amount')
  const row = { provider, payment_id: paymentId, order_number: orderNumber,
    amount_pence: amountPence, currency, evidence }
  const { error } = await supabaseAdmin.from('payment_receipts').insert(row)
  if (error && error.code !== '23505') throw error
  if (error) {
    const { data: saved, error: readError } = await supabaseAdmin.from('payment_receipts')
      .select('order_number,amount_pence,currency').eq('provider', provider).eq('payment_id', paymentId).single()
    if (readError || saved.order_number !== orderNumber || Number(saved.amount_pence) !== amountPence || saved.currency !== currency) {
      throw new Error('Conflicting payment receipt')
    }
  }
}

export async function completeOrder(provider, paymentId) {
  const { data, error } = await supabaseAdmin.rpc('complete_payment_checkout', {
    p_provider: provider, p_payment_id: paymentId,
  })
  if (error) throw error
  return data
}

export async function deliverNotifications(orderNumber) {
  const { data: job, error } = await supabaseAdmin.from('payment_notifications').select('*')
    .eq('order_number', orderNumber).maybeSingle()
  if (error) throw error
  if (!job) return
  const { order, items } = job.payload
  const names = (order.shipping_name || '').split(' ')
  const payload = { order, items,
    form: { email: order.customer_email, firstName: names.shift(), lastName: names.join(' '),
      line1: order.shipping_line1, line2: order.shipping_line2 || '', city: order.shipping_city,
      postcode: order.shipping_postcode, country: order.shipping_country, phone: order.phone || '' },
    totals: { subtotal: order.subtotal_gbp, shipping: order.shipping_gbp, total: order.total_gbp,
      freeShipping: Number(order.shipping_gbp) === 0 },
  }
  const failures = []
  for (const [field, send] of [['customer_sent_at', sendOrderConfirmation], ['owner_sent_at', sendOwnerNotification]]) {
    if (job[field]) continue
    try {
      await send({ ...payload, deliveryKey: `payment/${orderNumber}/${field}` })
      const { error: saveError } = await supabaseAdmin.from('payment_notifications')
        .update({ [field]: new Date().toISOString() }).eq('order_number', orderNumber)
      if (saveError) throw saveError
    } catch (err) { failures.push(err) }
  }
  if (failures.length) throw failures[0]
}
