import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { gbpToPence } from '@/lib/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { items, form, totals } = await req.json()

    // 商品标价已含税，直接用
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: item.name,
          description: item.skuDesc,
        },
        unit_amount: gbpToPence(item.price),
      },
      quantity: item.qty,
    }))

    // 运费
    if (parseFloat(totals.shipping) > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: { name: 'Shipping' },
          unit_amount: gbpToPence(totals.shipping),
        },
        quantity: 1,
      })
    }

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
      },
    })

    await supabaseAdmin.from('orders').insert({
      order_number: orderNumber,
      customer_email: form.email,
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
