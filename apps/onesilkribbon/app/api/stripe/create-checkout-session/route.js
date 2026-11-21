import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { gbpToPence } from '@/lib/pricing'
import { computeAuthoritativeOrder, checkoutPriceChange } from '@/lib/order-pricing'
import { getAuthUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'
import { saveCheckoutDetailsToAccount } from '@/lib/user-records'
import { newOrderNumber, orderRecord } from '@/lib/payment-orders'
import { checkoutForm } from '@/lib/checkout-form'
import { createCancelProof } from '@/lib/payment-proof'
import { releaseFailedStripeCreation, refreshCheckoutReservations, prepareStripeOrder, beginStripeCreation } from '@/lib/stripe-reservations'
import { claimCheckout, saveCheckoutReply, discardCheckoutClaim } from '@/lib/checkout-requests'

export async function POST(req) {
  let orderNumber, stripe, session
  let prepared = false, attempted = false
  let claimKey, preparationStarted = false, boundReply = false
  try {
    const { items, form: rawForm, coupon, totals: reviewedTotals, requestKey } = (await req.json()) || {}
    const form = checkoutForm(rawForm)
    await refreshCheckoutReservations()
    const user = await getAuthUser(req)
    const userId = user?.id
    orderNumber = newOrderNumber()
    const claim = await claimCheckout({ provider: 'stripe', requestKey, form, items, coupon, reviewedTotals, userId, orderNumber })
    if (claim.response) return claim.response
    claimKey = claim.key
    const priced = await computeAuthoritativeOrder({ items, couponCode: coupon?.code })
    if (!priced.ok) return Response.json({ error: priced.error, unavailable: priced.unavailable }, { status: 409 })
    const { lineItems, totals } = priced
    if (reviewedTotals !== undefined) {
      const change = checkoutPriceChange(reviewedTotals, priced)
      if (change) return change
    }
    // The order, every item, and its recovery snapshot commit BEFORE a payable URL exists.
    // Leave headroom above Stripe's 30-minute minimum for DB/network latency.
    const expiresAt = Math.floor(Date.now() / 1000) + 45 * 60
    preparationStarted = true
    await prepareStripeOrder(orderRecord({ orderNumber, form, totals, userId: user?.id, provider: 'stripe' }), lineItems, expiresAt)
    prepared = true
    // Do not turn a first-response timeout into a later 4xx that appears definitive.
    // Ambiguous creation is recovered through the saved attempt/provider lookup.
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 0 })
    await beginStripeCreation(orderNumber)
    attempted = true
    session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], mode: 'payment', customer_email: form.email,
      expires_at: expiresAt,
      line_items: [{ price_data: { currency: 'gbp', unit_amount: gbpToPence(totals.total),
        product_data: { name: 'One Silk Ribbon Order',
          description: lineItems.map(i => `${i.name} ×${i.qty}`).join(', ').slice(0, 500) } }, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment-confirmation?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/cancel?order=${encodeURIComponent(orderNumber)}&proof=${encodeURIComponent(createCancelProof(orderNumber))}`,
      metadata: { orderNumber, couponCode: totals.couponCode || '' },
      payment_intent_data: { metadata: { orderNumber } },
    }, { idempotencyKey: `checkout/${orderNumber}` })
    const { error: identityError } = await supabaseAdmin.from('stripe_checkout_attempts')
      .update({ session_id: session.id }).eq('order_number', orderNumber)
    if (identityError) throw identityError
    const { data: bound, error } = await supabaseAdmin.from('orders')
      .update({ payment_intent_id: session.id }).eq('order_number', orderNumber).eq('status', 'pending')
      .select('id').single()
    if (error || !bound || !session.url) {
      // Never hand out a payment URL whose binding was not saved.
      throw error || new Error('Checkout binding failed')
    }
    await saveCheckoutDetailsToAccount({ userId: user?.id, form })
    const reply = { url: session.url, sessionId: session.id }
    boundReply = true
    await saveCheckoutReply(claimKey, orderNumber, reply, new Date(expiresAt * 1000).toISOString())
    return Response.json(reply)
  } catch (err) {
    if (prepared && !boundReply) {
      try { await releaseFailedStripeCreation({ orderNumber, stripe, session, attempted, error: err }) }
      catch { console.error('Stripe checkout needs safe reconciliation', orderNumber) }
    }
    if (err?.code === 'INVALID_CHECKOUT_FORM' || err instanceof SyntaxError) return Response.json({ error: 'Please check your contact and delivery details.' }, { status: 400 })
    if (!prepared && err?.code === 'P0001') preparationStarted = false
    if (err?.code === 'P0001') return Response.json({ error: 'Stock or promo availability changed. Please review your basket and try again.' }, { status: 409 })
    return errorResponse(err, { tag: 'stripe-create-checkout-session' })
  } finally {
    if (claimKey && !preparationStarted) {
      try { await discardCheckoutClaim(claimKey, orderNumber) }
      catch { console.error('Checkout request cleanup failed', orderNumber) }
    }
  }
}
