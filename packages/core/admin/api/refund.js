// /api/admin/refund —— 两个站共用
import Stripe from 'stripe'
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { CAN } from '../lib/status'
import { restockItems } from './_helpers'

// POST { orderId, reason?, manual?, restock? }
//   manual=true  —— 钱已经在 Stripe / PayPal 后台退过了，这里只把订单记成"已退款"
//                   （PayPal 退款没接自动接口，以前退完之后系统里没有办法把订单标成已退款）
//   restock=true —— 把这单的商品数量加回库存（货没发出去或退回来了的时候用）
export async function POST(req) {
  const admin = await verifyAdmin({ strict: true }) // 退款不可撤销：再向 Supabase 确认一次登录状态
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { orderId, reason, manual, restock } = await req.json()

    const { data: order } = await supabaseAdmin
      .from('orders').select('*').eq('id', orderId).maybeSingle()
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
    if (!CAN.refund(order.status)) {
      return Response.json({ error: `订单当前是「${order.status}」，不能退款` }, { status: 409 })
    }

    if (!manual) {
      if (order.payment_method === 'paypal') {
        return Response.json({
          success: false, needsManual: true,
          error: `PayPal 订单需要在 PayPal 后台手动退款（Payment ID：${order.payment_intent_id}），退完后选择"我已手动退款"`,
        })
      }
      if (order.payment_method !== 'stripe' || !order.payment_intent_id) {
        return Response.json({ success: false, needsManual: true, error: '这单无法自动退款，请到支付后台手动处理后选择"我已手动退款"' })
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      // 如果存的是 session id（cs_xxx），先换成 payment_intent
      let paymentIntentId = order.payment_intent_id
      if (paymentIntentId.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(paymentIntentId)
        paymentIntentId = session.payment_intent
      }
      if (!paymentIntentId) {
        return Response.json({ success: false, needsManual: true, error: '找不到这单的 Stripe 付款记录，请到 Stripe 后台手动处理' })
      }
      await stripe.refunds.create({ payment_intent: paymentIntentId, reason: 'requested_by_customer' })
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'refunded', refund_reason: reason || (manual ? '已在支付后台手动退款' : null) })
      .eq('id', orderId)
      .select()
      .single()
    if (updateError) {
      console.error('Refund succeeded but order update failed:', updateError)
      return Response.json({
        success: false,
        error: manual ? '订单状态没能更新，请重试' : '钱已经退了，但订单状态没能更新成"已退款"，请刷新后再标记一次',
      }, { status: 500 })
    }

    let restocked = null
    if (restock) {
      const { data: items } = await supabaseAdmin.from('order_items').select('sku_id, quantity').eq('order_id', orderId)
      const results = await restockItems(supabaseAdmin, items)
      restocked = {
        ok: results.filter(r => r.ok).reduce((n, r) => n + r.qty, 0),
        failed: results.filter(r => !r.ok).length,
      }
    }

    return Response.json({ success: true, order: updatedOrder, restocked })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-refund' })
  }
}
