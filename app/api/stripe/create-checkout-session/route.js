import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { gbpToPence } from '@/lib/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { items, form, totals, userId } = await req.json()

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

    // 创建订单
    const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert({
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
    }).select('id').single()

    // 写入商品明细
    if (!orderError && order?.id && items?.length > 0) {
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.productId || null,
        sku_id: item.skuId || null,
        product_name: item.name || 'Unknown Product',
        sku_description: item.skuDesc || '',
        quantity: item.qty || 1,
        unit_price_gbp: item.price || 0,
        line_total_gbp: (item.price || 0) * (item.qty || 1),
      }))
      await supabaseAdmin.from('order_items').insert(orderItems)
    }

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
