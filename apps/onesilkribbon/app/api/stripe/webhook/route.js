import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
import { deductStock, incrementCouponUses } from '@/lib/stock-check'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// 旧版 payment_intent.payment_failed 处理取消订单时写入的原因，用来识别可以恢复的订单
const LEGACY_PAYMENT_FAILED_REASON = '支付失败'

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
      const paidPatch = {
        status: 'paid',
        paid_at: new Date().toISOString(),
        user_id: userId || undefined,
        payment_intent_id: paymentIntentId,
      }
      let { data: claimed, error: claimError } = await supabaseAdmin.from('orders')
        .update(paidPatch)
        .eq('order_number', orderNumber)
        .eq('status', 'pending')
        .select()

      // 旧版本在 payment_intent.payment_failed 时会把订单直接改成 cancelled，可客户在同一个
      // Checkout 页里换张卡就能重试成功——于是钱收到了，订单却停在"已取消"，上面那条只认
      // pending 的认领拿不到它，被当成重复事件跳过：不扣库存、不发确认邮件。
      // 现在支付失败不再取消订单，但那段时间里被这样取消的订单仍可能付款成功，这里把它认领回来。
      // 只认 cancel_reason 恰好是那段代码写的值，后台手动取消的订单不会被动到。
      if (!claimError && (!claimed || claimed.length === 0)) {
        ;({ data: claimed, error: claimError } = await supabaseAdmin.from('orders')
          .update({ ...paidPatch, cancel_reason: null, cancelled_at: null })
          .eq('order_number', orderNumber)
          .eq('status', 'cancelled')
          .eq('cancel_reason', LEGACY_PAYMENT_FAILED_REASON)
          .select())
      }

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
      // 不要在这里取消订单。Checkout 里一次扣款失败不是终态：客户会看到报错，
      // 可以在同一个页面换卡重试，重试成功照样会来 checkout.session.completed。
      // 之前在这里把订单改成 cancelled，重试成功后的认领就找不到 pending 订单了（见上面）。
      // 订单保持 pending，客户最终没付的话，和其他放弃结账的订单一样由后台「数据维护」清理。
      const pi = event.data.object
      console.warn('[stripe-webhook] 一次付款尝试失败（订单保持待付款，客户可重试）:',
        pi.metadata?.orderNumber || pi.id, pi.last_payment_error?.code || '')
      break
    }
  }

  return Response.json({ received: true })
}
