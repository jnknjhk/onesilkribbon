import Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { recordPayment, completeOrder, deliverNotifications } from '@/lib/payment-orders'

const client = () => new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 })
export function stripeProviderScope() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe configuration unavailable')
  // Conservative: key rotation requires explicit reconciliation even for the same
  // account. Never mistake a different account/test mode for an empty provider.
  return createHash('sha256').update(process.env.STRIPE_SECRET_KEY).digest('hex')
}
export async function prepareStripeOrder(order, items, expiresAt) {
  const { data, error } = await supabaseAdmin.rpc('prepare_stripe_checkout', {
    p_order:order,p_items:items,p_expires_at:new Date(expiresAt*1000).toISOString(),p_scope:stripeProviderScope(),
  })
  if (error) throw error
  if (!data?.id) throw new Error('Stripe preparation was not saved')
  return data
}
export async function beginStripeCreation(orderNumber) {
  const { error } = await supabaseAdmin.rpc('begin_stripe_creation',{p_order_number:orderNumber})
  if (error) throw error
}
async function release(orderNumber, reason) {
  const { error } = await supabaseAdmin.rpc('release_checkout_reservation', { p_order_number: orderNumber, p_reason: reason })
  if (error) throw error
}

// A timeout/5xx is NOT evidence of failure: Stripe may have created the session.
export function definitelyRejected(error) {
  return ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error?.type) &&
    [400,401,403,404].includes(error?.statusCode) && error?.code !== 'idempotency_key_in_use'
}
async function closeUnpaidSession(stripe, session) {
  if (session.payment_status === 'paid' || session.status === 'complete') throw new Error('Stripe payment exists; reservation retained')
  if (session.status === 'open') {
    try { session = await stripe.checkout.sessions.expire(session.id) }
    catch { session = await stripe.checkout.sessions.retrieve(session.id) }
  }
  if (session.status !== 'expired' || session.payment_status === 'paid') throw new Error('Stripe expiry unconfirmed; reservation retained')
  return session
}

export async function releaseFailedStripeCreation({ orderNumber, stripe, session, attempted, error }) {
  if (session?.id) {
    await closeUnpaidSession(stripe, session)
  } else if (attempted && !definitelyRejected(error)) {
    return false
  }
  await release(orderNumber, 'Stripe 付款链接创建失败或已关闭')
  return true
}

async function findSessions(stripe, order, attempt) {
  const sessionId = attempt?.session_id || (order.payment_intent_id?.startsWith('cs_') ? order.payment_intent_id : null)
  if (sessionId) return [await stripe.checkout.sessions.retrieve(sessionId)]
  if (!attempt) throw new Error('Legacy Stripe checkout has no saved deadline; reconcile manually')
  // A provider call can only create a session before its immutable expires_at.
  // Fully scan that window; never equate a failed or truncated listing with absence.
  const created = { gte: Math.floor(new Date(attempt.created_at).getTime()/1000)-300,
    lte: Math.ceil(new Date(attempt.expires_at).getTime()/1000) }
  const matches = []
  let starting_after
  for (let page = 0; page < 10; page++) {
    const result = await stripe.checkout.sessions.list({ created, limit: 100, ...(starting_after ? { starting_after } : {}) })
    matches.push(...result.data.filter(s => s.metadata?.orderNumber === order.order_number))
    if (!result.has_more) return matches
    if (!result.data.length) throw new Error('Stripe listing incomplete')
    starting_after = result.data[result.data.length-1].id
  }
  throw new Error('Stripe listing exceeded safe page limit; reservation retained')
}

export async function reconcileStripeReservation(orderNumber, { cancel = false, stripe = client() } = {}) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('order_number', orderNumber).single()
  if (error) throw error
  if (order.payment_method !== 'stripe') throw new Error('Not a Stripe order')
  if (order.status !== 'pending') return { status: order.status }
  const { data: attempt, error: attemptError } = await supabaseAdmin.from('stripe_checkout_attempts')
    .select('*').eq('order_number', orderNumber).maybeSingle()
  if (attemptError) throw attemptError
  if (attempt) {
    if (!attempt.provider_scope || attempt.provider_scope !== stripeProviderScope()) throw new Error('Stripe key/account scope changed; reconcile with original account')
    if (!attempt.provider_started_at) {
      const { error: releaseError } = await supabaseAdmin.rpc('release_unstarted_stripe_checkout',{p_order_number:orderNumber})
      if (releaseError) throw releaseError
      return { status:'cancelled' }
    }
  }
  const sessions = await findSessions(stripe, order, attempt)
  if (sessions.length > 1) throw new Error('Multiple Stripe sessions require manual reconciliation')
  const session = sessions[0]
  if (!session) {
    if (!attempt || Date.now() < new Date(attempt.expires_at).getTime()+120000) {
      throw new Error('Stripe creation may still be in progress; reservation retained')
    }
    await release(orderNumber, 'Stripe 创建截止时间已过，平台完整查询确认无付款链接')
    return { status: 'cancelled' }
  }
  if (session.metadata?.orderNumber !== orderNumber || session.currency !== 'gbp' ||
    session.amount_total !== Math.round(Number(order.total_gbp)*100)) throw new Error('Stripe checkout identity/amount mismatch')
  if (session.payment_status === 'paid') {
    const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    if (!paymentId) throw new Error('Stripe payment identity missing')
    if (!order.payment_intent_id) {
      const { error: bindError } = await supabaseAdmin.from('orders').update({ payment_intent_id: session.id })
        .eq('order_number', orderNumber).eq('status', 'pending').is('payment_intent_id', null)
      if (bindError) throw bindError
    } else if (![session.id,paymentId].includes(order.payment_intent_id)) throw new Error('Stripe binding conflict')
    await recordPayment({ provider: 'stripe', paymentId, orderNumber, amountPence: session.amount_total,
      currency: 'GBP', evidence: { recovered_session: session } })
    await completeOrder('stripe', paymentId)
    await deliverNotifications(orderNumber)
    return { status: 'paid' }
  }
  if (session.status === 'open' && !cancel) return { status: 'pending' }
  await closeUnpaidSession(stripe, session)
  await release(orderNumber, 'Stripe 平台已确认未付款链接关闭')
  return { status: 'cancelled' }
}

// Only local, transactional cleanup runs inline with checkout. Provider lookups
// run through signed webhooks/admin recovery, never delaying a new buyer's order.
export async function refreshCheckoutReservations() {
  const { error: paypalExpiryError } = await supabaseAdmin.rpc('release_expired_paypal_reservations')
  if (paypalExpiryError) throw paypalExpiryError
  const { error } = await supabaseAdmin.rpc('release_abandoned_stripe_preparations')
  if (error) throw error
}
