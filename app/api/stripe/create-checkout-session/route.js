import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { gbpToPence } from '@/lib/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { items, form, totals, userId } = await req.json()

    // 直接用实际应付总额（已含折扣+运费）作为单笔收款
    const totalAmount = gbpToPence(totals.total)

    const orderDesc = items.map(i => `${i.name}${i.skuDesc ? ' · ' + i.skuDesc : ''} ×${i.qty}`).join(', ')

    const lineItems = [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'One Silk Ribbon Order',
          description: orderDesc,
        },
        unit_amount: totalAmount,
      },
      quantity: 1,
    }]

    const orderNumber = `OSR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: form.email,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order-confirmed?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout`,
      metadata: {
        orderNumber,
        customerEmail: form.email,
        shippingName: `${form.firstName} ${form.lastName}`,
        couponCode: totals.couponCode || '',
        userId: userId || '',
      },
    })

    await supabaseAdmin.from('orders').insert({
      order_number: orderNumber,
      customer_email: form.email,
      user_id: userId || null,
      status: 'pending',
      subtotal_gbp: totals.subtotal,
      vat_amount_gbp: '0.00',
      shipping_gbp: totals.shipping,
      total_gbp: totals.total,
      shipping_name: `${form.firstName} ${form.lastName}`,
      shipping_line1: form.line1,
      shipping_line2: form.line2 || null,
      shipping_city: form.city,
      shipping_postcode: form.postcode,
      shipping_country: form.country,
      payment_method: 'stripe',
      payment_intent_id: session.id,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
