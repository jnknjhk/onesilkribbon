import { createHmac } from 'node:crypto'
import { supabaseAdmin } from '@osr/core/lib/supabase'

const table = () => supabaseAdmin.from('checkout_requests')
const unavailable = () => Response.json({
  code: 'checkout_in_progress',
  error: 'This checkout is still being processed. Wait a moment and retry the same payment method.',
}, { status: 409 })

export async function claimCheckout({ provider, requestKey, form, items, coupon, reviewedTotals, userId, orderNumber }) {
  if (typeof requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    return { response: Response.json({ error: 'Invalid checkout request. Refresh the page and try again.' }, { status: 400 }) }
  }
  const key = createHmac('sha256', process.env.SUPABASE_SERVICE_KEY)
    .update(JSON.stringify([provider, requestKey, userId || null, form, items, coupon?.code || '', reviewedTotals]))
    .digest('hex')
  const row = { request_key: key, order_number: orderNumber }
  const { error } = await table().insert(row)
  if (!error) return { key }
  if (error.code !== '23505') throw error

  const { data: saved, error: readError } = await table().select('order_number,reply,expires_at')
    .eq('request_key', key).maybeSingle()
  if (readError) throw readError
  if (!saved) return { response: unavailable() }
  const { data: order, error: orderError } = await supabaseAdmin.from('orders')
    .select('status').eq('order_number', saved.order_number).maybeSingle()
  if (orderError) throw orderError
  if (order?.status === 'cancelled') {
    const { data: claimed, error: claimError } = await table()
      .update({ order_number: orderNumber, reply: null, expires_at: null })
      .eq('request_key', key).eq('order_number', saved.order_number).select('request_key').maybeSingle()
    if (claimError) throw claimError
    if (claimed) return { key }
  }
  if (order?.status === 'pending' && saved.reply && Date.parse(saved.expires_at) > Date.now()) {
    return { response: Response.json(saved.reply, { headers: { 'Cache-Control': 'no-store' } }) }
  }
  if (order && !['pending', 'cancelled'].includes(order.status)) {
    return { response: Response.json({
      code: 'checkout_already_completed',
      error: 'This checkout is already complete. Check your order confirmation before paying again.',
    }, { status: 409 }) }
  }
  return { response: unavailable() }
}

export async function saveCheckoutReply(key, orderNumber, reply, expiresAt) {
  const { error } = await table().update({ reply, expires_at: expiresAt })
    .eq('request_key', key).eq('order_number', orderNumber).select('request_key').single()
  if (error) throw error
}

export async function discardCheckoutClaim(key, orderNumber) {
  const { error } = await table().delete().eq('request_key', key).eq('order_number', orderNumber)
  if (error) throw error
}
