import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { gbpToPence } from '@/lib/pricing'
import { computeAuthoritativeOrder } from '@/lib/order-pricing'
import { getAuthUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'
import { saveCheckoutDetailsToAccount } from '@/lib/user-records'
import { newOrderNumber, orderRecord, prepareOrder } from '@/lib/payment-orders'

export async function POST(req) {
  try {
    const { items, form, coupon } = await req.json()
    const user = await getAuthUser(req)
    const priced = await computeAuthoritativeOrder({ items, couponCode: coupon?.code })
    if (!priced.ok) return Response.json({ error: priced.error, unavailable: priced.unavailable }, { status: 409 })
    const { lineItems, totals } = priced
    const orderNumber = newOrderNumber()
    // The order, every item, and its recovery snapshot commit BEFORE a payable URL exists.
    await prepareOrder(orderRecord({ orderNumber, form, totals, userId: user?.id, provider: 'stripe' }), lineItems)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], mode: 'payment', customer_email: form.email,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [{ price_data: { currency: 'gbp', unit_amount: gbpToPence(totals.total),
        product_data: { name: 'One Silk Ribbon Order',
          description: lineItems.map(i => `${i.name} ×${i.qty}`).join(', ').slice(0, 500) } }, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order-confirmed?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout`,
      metadata: { orderNumber, couponCode: totals.couponCode || '' },
      payment_intent_data: { metadata: { orderNumber } },
    }, { idempotencyKey: `checkout/${orderNumber}` })
    const { data: bound, error } = await supabaseAdmin.from('orders')
      .update({ payment_intent_id: session.id }).eq('order_number', orderNumber).eq('status', 'pending')
      .select('id').single()
    if (error || !bound || !session.url) {
      // Never hand out a payment URL whose binding was not saved.
      try { await stripe.checkout.sessions.expire(session.id) } catch (err) { console.error('Expire checkout failed', session.id, err.message) }
      throw error || new Error('Checkout binding failed')
    }
    await saveCheckoutDetailsToAccount({ userId: user?.id, form })
    return Response.json({ url: session.url })
  } catch (err) {
    if (err?.code === 'P0001') return Response.json({ error: 'Stock or promo availability changed. Please review your basket and try again.' }, { status: 409 })
    return errorResponse(err, { tag: 'stripe-create-checkout-session' })
  }
}
