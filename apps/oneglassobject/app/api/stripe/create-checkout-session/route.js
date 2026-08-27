import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { gbpToPence } from '@/lib/pricing'
import { computeAuthoritativeOrder } from '@/lib/order-pricing'
import { getAuthUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { items, form, coupon } = await req.json()
    // userId 绝不信任客户端传的值——否则任何人都能把订单挂到别人账号下。
    // 从请求本身的 token/cookie 里解析出真正登录的用户，没登录就是 null（访客下单）。
    const authUser = await getAuthUser(req)
    const userId = authUser?.id || null

    // 服务端重新核算价格与库存，绝不信任客户端传来的 totals/price
    const priced = await computeAuthoritativeOrder({ items, couponCode: coupon?.code })
    if (!priced.ok) {
      return Response.json({ error: priced.error, unavailable: priced.unavailable }, { status: 409 })
    }
    const { lineItems: orderLineItems, totals } = priced

    const totalAmount = gbpToPence(totals.total)
    const orderDesc = orderLineItems.map(i => `${i.name}${i.skuDesc ? ' · ' + i.skuDesc : ''} ×${i.qty}`).join(', ')

    const lineItems = [{
      price_data: {
        currency: 'gbp',
        product_data: { name: 'One Glass Object Order', description: orderDesc },
        unit_amount: totalAmount,
      },
      quantity: 1,
    }]

    const orderNumber = `OSR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${String(Date.now()).slice(-3)}`

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
        phone: form.phone || '',
        dialCode: form.dialCode || '',
      },
    })

    const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert({
      order_number:      orderNumber,
      customer_email:    form.email,
      user_id:           userId || null,
      status:            'pending',
      subtotal_gbp:      totals.subtotal,
      vat_amount_gbp:    '0.00',
      shipping_gbp:      totals.shipping,
      discount_gbp:      totals.discount || '0.00',
      total_gbp:         totals.total,
      shipping_name:     `${form.firstName} ${form.lastName}`,
      shipping_line1:    form.line1,
      shipping_line2:    form.line2 || null,
      shipping_city:     form.city,
      shipping_postcode: form.postcode,
      shipping_country:  form.country,
      phone:             form.phone ? `${form.dialCode || ''} ${form.phone}`.trim() : null,
      payment_method:    'stripe',
      payment_intent_id: session.id, // webhook 收到后会更新为真正的 payment_intent
    }).select('id').single()

    if (!orderError && order?.id && orderLineItems.length > 0) {
      const orderItems = orderLineItems.map(item => ({
        order_id:        order.id,
        product_id:      item.productId || null,
        sku_id:          item.skuId || null,
        product_name:    item.name || 'Unknown Product',
        sku_description: item.skuDesc || '',
        quantity:        item.qty,
        unit_price_gbp:  item.price,
        line_total_gbp:  item.price * item.qty,
      }))
      await supabaseAdmin.from('order_items').insert(orderItems)
    }

    return Response.json({ url: session.url })
  } catch (err) {
    return errorResponse(err, { tag: 'stripe-create-checkout-session' })
  }
}
