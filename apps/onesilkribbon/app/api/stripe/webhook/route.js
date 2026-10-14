import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { errorResponse } from '@osr/core/lib/api-error'
import { recordPayment, prepareOrder, completeOrder, deliverNotifications } from '@/lib/payment-orders'

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  let event
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)
  } catch { return Response.json({ error: 'Webhook signature failed' }, { status: 400 }) }
  if (event.type === 'checkout.session.expired') {
    try {
      const session = event.data.object
      const { data: order, error } = await supabaseAdmin.from('orders').select('order_number,payment_intent_id,status,payment_method')
        .eq('order_number', session.metadata?.orderNumber || '').maybeSingle()
      if (error) throw error
      if (!order || order.status !== 'pending') return Response.json({ received: true })
      if (order.payment_method !== 'stripe' || order.payment_intent_id !== session.id) throw new Error('Expired checkout identity mismatch')
      const { error: releaseError } = await supabaseAdmin.rpc('release_checkout_reservation', {
        p_order_number: order.order_number, p_reason: 'Stripe 付款链接已过期',
      })
      if (releaseError) throw releaseError
      return Response.json({ received: true })
    } catch (err) { return errorResponse(err, { status: 503, tag: 'stripe-checkout-expired' }) }
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return Response.json({ received: true })
  }
  const session = event.data.object
  if (session.payment_status !== 'paid') return Response.json({ received: true })
  try {
    const orderNumber = session.metadata?.orderNumber
    const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    if (!orderNumber || !paymentId) throw new Error('Paid session missing order/payment identity')
    // Durable evidence is stored even when subsequent finalization fails.
    await recordPayment({ provider: 'stripe', paymentId, orderNumber,
      amountPence: session.amount_total, currency: String(session.currency).toUpperCase(), evidence: event })
    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('order_number', orderNumber).single()
    if (error) throw error
    if (order.payment_method !== 'stripe' || Math.round(Number(order.total_gbp) * 100) !== session.amount_total ||
        session.currency !== 'gbp' ||
        ![session.id, paymentId].includes(order.payment_intent_id)) throw new Error('Stripe order/payment mismatch')
    const { data: snapshot, error: snapshotError } = await supabaseAdmin.from('payment_checkouts')
      .select('order_number').eq('order_number', orderNumber).maybeSingle()
    if (snapshotError) throw snapshotError
    if (!snapshot) {
      // Historical paid orders may already have deducted stock. Never deduct them again.
      if (!['pending', 'cancelled'].includes(order.status)) return Response.json({ received: true, legacy: true })
      const { data: items, error: itemsError } = await supabaseAdmin.from('order_items').select('*').eq('order_id', order.id)
      if (itemsError || !items?.length) throw itemsError || new Error('Historical paid session has no items')
      // Legacy cancelled orders need explicit reconciliation rather than destructive rewriting.
      await prepareOrder({ ...order, couponCode: session.metadata?.couponCode || '' }, items.map(i => ({
        productId: i.product_id, skuId: i.sku_id, name: i.product_name,
        skuDesc: i.sku_description, qty: i.quantity, price: Number(i.unit_price_gbp),
      })))
    }
    await completeOrder('stripe', paymentId)
    await deliverNotifications(orderNumber)
    return Response.json({ received: true })
  } catch (err) {
    // A 503 asks Stripe to retry; no partially committed inventory/status changes.
    return errorResponse(err, { status: 503, tag: 'stripe-webhook' })
  }
}
