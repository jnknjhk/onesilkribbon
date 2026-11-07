import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { errorResponse } from '@osr/core/lib/api-error'
import { recordPayment, recordExternalRefund, prepareOrder, completeOrder, deliverNotifications } from '@/lib/payment-orders'
import { stripeProviderScope } from '@/lib/stripe-reservations'

async function stripeOrderForPayment(paymentIntent, orderNumberHint) {
  if (orderNumberHint) {
    const { data, error } = await supabaseAdmin.from('orders')
      .select('order_number,total_gbp,status,payment_method').eq('order_number', orderNumberHint).maybeSingle()
    if (error) throw error
    if (data?.payment_method === 'stripe') return data
  }
  if (!paymentIntent) return null
  const { data: receipt, error } = await supabaseAdmin.from('payment_receipts')
    .select('order_number').eq('provider', 'stripe').eq('payment_id', paymentIntent).maybeSingle()
  if (error) throw error
  if (receipt?.order_number) {
    const { data, error: orderError } = await supabaseAdmin.from('orders')
      .select('order_number,total_gbp,status,payment_method').eq('order_number', receipt.order_number).maybeSingle()
    if (orderError) throw orderError
    return data?.payment_method === 'stripe' ? data : null
  }
  const { data, error: orderError } = await supabaseAdmin.from('orders')
    .select('order_number,total_gbp,status,payment_method').eq('payment_intent_id', paymentIntent).maybeSingle()
  if (orderError) throw orderError
  return data?.payment_method === 'stripe' ? data : null
}

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  let event
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)
  } catch { return Response.json({ error: 'Webhook signature failed' }, { status: 400 }) }
  if (event.type === 'checkout.session.expired') {
    try {
      const session = event.data.object
      const { data: order, error } = await supabaseAdmin.from('orders').select('order_number,payment_intent_id,status,payment_method,total_gbp')
        .eq('order_number', session.metadata?.orderNumber || '').maybeSingle()
      if (error) throw error
      if (!order || order.status !== 'pending') return Response.json({ received: true })
      if (order.payment_method !== 'stripe') throw new Error('Expired checkout identity mismatch')
      if (session.currency !== 'gbp' || session.amount_total !== Math.round(Number(order.total_gbp)*100)) throw new Error('Expired checkout amount mismatch')
      if (order.payment_intent_id !== session.id) {
        // A provider session can expire even if the response/binding write was lost.
        const { data: attempt, error: attemptError } = await supabaseAdmin.from('stripe_checkout_attempts')
          .select('session_id,provider_scope,provider_started_at').eq('order_number',order.order_number).maybeSingle()
        if (attemptError) throw attemptError
        if (order.payment_intent_id || !attempt?.provider_started_at || attempt.provider_scope !== stripeProviderScope() ||
          (attempt.session_id && attempt.session_id !== session.id)) {
          throw new Error('Expired checkout identity mismatch')
        }
      }
      const { error: releaseError } = await supabaseAdmin.rpc('release_checkout_reservation', {
        p_order_number: order.order_number, p_reason: 'Stripe 付款链接已过期',
      })
      if (releaseError) throw releaseError
      return Response.json({ received: true })
    } catch (err) { return errorResponse(err, { status: 503, tag: 'stripe-checkout-expired' }) }
  }
  if (event.type === 'checkout.session.async_payment_failed') {
    try {
      const session = event.data.object
      const orderNumber = session.metadata?.orderNumber
      if (!orderNumber) return Response.json({ received: true })
      const { data: order, error } = await supabaseAdmin.from('orders')
        .select('order_number,status,payment_method,total_gbp').eq('order_number', orderNumber).maybeSingle()
      if (error) throw error
      if (!order || order.status !== 'pending') return Response.json({ received: true })
      if (order.payment_method !== 'stripe' ||
          (session.amount_total != null &&
            (session.currency !== 'gbp' || session.amount_total !== Math.round(Number(order.total_gbp) * 100)))) {
        throw new Error('Async payment identity/amount mismatch')
      }
      const { error: releaseError } = await supabaseAdmin.rpc('release_checkout_reservation', {
        p_order_number: orderNumber, p_reason: 'Stripe 异步付款失败',
      })
      if (releaseError) throw releaseError
      return Response.json({ received: true })
    } catch (err) {
      return errorResponse(err, { status: 503, tag: 'stripe-async-payment-failed' })
    }
  }

  if (['charge.refunded', 'refund.created', 'refund.updated'].includes(event.type)) {
    try {
      const object = event.data.object
      const refunds = event.type === 'charge.refunded'
        ? (Array.isArray(object.refunds?.data) && object.refunds.data.length
            ? object.refunds.data
            : object.refunded
              ? [{ id: `charge:${object.id}`, amount: object.amount_refunded, currency: object.currency, status: 'succeeded', payment_intent: object.payment_intent }]
              : [])
        : [object]
      const orderHint = event.type === 'charge.refunded' ? object.metadata?.orderNumber : null

      for (const refund of refunds) {
        if (!refund || (refund.status && refund.status !== 'succeeded')) continue
        const paymentIntent = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id
        const order = await stripeOrderForPayment(paymentIntent, orderHint)
        if (!order) continue
        const amountPence = Number(refund.amount)
        if (!Number.isSafeInteger(amountPence) || amountPence <= 0) continue
        const currency = String(refund.currency || object.currency || 'gbp').toUpperCase()
        const full = event.type === 'charge.refunded'
          ? object.refunded === true
          : amountPence >= Math.round(Number(order.total_gbp) * 100)
        await recordExternalRefund({
          provider: 'stripe',
          refundId: String(refund.id || object.id),
          orderNumber: order.order_number,
          paymentId: paymentIntent || null,
          amountPence,
          currency,
          full,
          evidence: {
            charge_id: event.type === 'charge.refunded' ? object.id : refund.charge || null,
            refund_id: refund.id || null,
            status: refund.status || null,
            reason: refund.reason || null,
          },
        })
      }
      return Response.json({ received: true })
    } catch (err) {
      return errorResponse(err, { status: 503, tag: 'stripe-refund-webhook' })
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    // Card retries inside the same Checkout session are normal; session expiry is the safe release signal.
    return Response.json({ received: true })
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
