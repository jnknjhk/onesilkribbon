import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
import { deductStock } from '@/lib/stock-check'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const orderNumber = session.metadata?.orderNumber
      if (!orderNumber) break

      const userId = session.metadata?.userId || null
      const paymentIntentId = session.payment_intent || session.id

      // 幂等性检查：如果已经是 paid 状态，跳过处理
      const { data: existingOrder } = await supabaseAdmin.from('orders')
        .select('id, status').eq('order_number', orderNumber).single()
      if (existingOrder?.status === 'paid' || existingOrder?.status === 'shipped') {
        console.error('Duplicate webhook event for order:', orderNumber)
        break
      }

      await supabaseAdmin.from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          user_id: userId || undefined,
          payment_intent_id: paymentIntentId,
        })
        .eq('order_number', orderNumber)

      const { data: order } = await supabaseAdmin.from('orders')
        .select('*').eq('order_number', orderNumber).single()

      // 优惠码使用次数递增
      const couponCode = session.metadata?.couponCode
      if (couponCode) {
        const { data: cp } = await supabaseAdmin.from('coupons').select('uses_count').eq('code', couponCode).single()
        if (cp) {
          await supabaseAdmin.from('coupons').update({ uses_count: (cp.uses_count || 0) + 1 }).eq('code', couponCode)
        }
      }

      if (order) {
        // 读取订单商品
        const { data: orderItems } = await supabaseAdmin
          .from('order_items').select('*').eq('order_id', order.id)

        // 扣减库存
        if (orderItems && orderItems.length > 0) {
          await deductStock(orderItems)
        }

        const items = (orderItems && orderItems.length > 0)
          ? orderItems.map(i => ({
              name: i.product_name,
              skuDesc: i.sku_description || '',
              price: parseFloat(i.unit_price_gbp),
              qty: i.quantity,
            }))
          : [{ name: 'One Silk Ribbon Order', skuDesc: '', price: parseFloat(order.subtotal_gbp), qty: 1 }]

        const form = {
          email:     order.customer_email,
          firstName: (order.shipping_name || '').split(' ')[0],
          lastName:  (order.shipping_name || '').split(' ').slice(1).join(' '),
          line1:     order.shipping_line1,
          line2:     order.shipping_line2 || '',
          city:      order.shipping_city,
          postcode:  order.shipping_postcode,
          country:   order.shipping_country,
          phone:     order.phone || '',
          dialCode:  '',
        }
        const totals = {
          subtotal:    order.subtotal_gbp,
          shipping:    order.shipping_gbp,
          total:       order.total_gbp,
          freeShipping: parseFloat(order.shipping_gbp) === 0,
        }

        try {
          await sendOrderConfirmation({ order, items, form, totals })
          await sendOwnerNotification({ order, items, form, totals })
        } catch (e) {
          console.error('Email send failed:', e)
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      await supabaseAdmin.from('orders')
        .update({ status: 'cancelled' })
        .eq('payment_intent_id', pi.id)
      break
    }
  }

  return Response.json({ received: true })
}
