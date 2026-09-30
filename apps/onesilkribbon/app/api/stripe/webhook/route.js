import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
import { deductStock, incrementCouponUses } from '@/lib/stock-check'

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

      // 幂等性：以前是"先 select 看状态，再 update"，两次 webhook 同时到达时
      // 两边都可能读到 pending，于是库存被扣两次、确认邮件发两封。
      // 改成带条件的单条 UPDATE——只有仍是 pending 才会被改动，谁改到了谁负责后续处理。
      // 返回 0 行就说明已经有人处理过了，直接跳过。
      const { data: claimed, error: claimError } = await supabaseAdmin.from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          user_id: userId || undefined,
          payment_intent_id: paymentIntentId,
        })
        .eq('order_number', orderNumber)
        .eq('status', 'pending')
        .select()

      if (claimError) {
        console.error('Webhook order claim failed for', orderNumber, claimError)
        break
      }
      if (!claimed || claimed.length === 0) {
        console.error('Duplicate webhook event for order:', orderNumber)
        break
      }
      const order = claimed[0]

      // 优惠码使用次数递增（单条 UPDATE，并发安全）
      await incrementCouponUses(session.metadata?.couponCode)

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
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      // 下单时 payment_intent_id 里存的是 Checkout Session 的 id（cs_...），
      // 只有支付成功的 webhook 才会把它换成真正的 pi_...。所以支付失败时拿 pi.id
      // 去比对 payment_intent_id 永远对不上，失败的订单会一直停在 pending，
      // 只能靠后台"数据维护"页手动清。
      // 现在建 Checkout Session 时把 orderNumber 一并写进了 PaymentIntent 的 metadata，
      // 这里直接按订单号定位；老订单没有这个 metadata，回退到原来的 id 比对。
      const failedOrderNumber = pi.metadata?.orderNumber
      const query = supabaseAdmin.from('orders')
        .update({ status: 'cancelled', cancel_reason: '支付失败', cancelled_at: new Date().toISOString() })
        // 只取消还没付成功的，避免极端时序下把一张已付款订单误标为取消
        .eq('status', 'pending')
      const { error: failError } = failedOrderNumber
        ? await query.eq('order_number', failedOrderNumber)
        : await query.eq('payment_intent_id', pi.id)
      if (failError) console.error('[stripe-webhook] 标记支付失败订单出错:', failError.message)
      break
    }
  }

  return Response.json({ received: true })
}
