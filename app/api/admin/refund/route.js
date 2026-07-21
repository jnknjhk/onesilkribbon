import { verifyAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { orderId, reason } = await req.json()

    const { data: order } = await supabaseAdmin
      .from('orders').select('*').eq('id', orderId).single()

    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

    // Stripe 退款
    if (order.payment_method === 'stripe' && order.payment_intent_id) {
      // 如果存的是 session id（cs_xxx），先获取 payment_intent
      let paymentIntentId = order.payment_intent_id
      if (paymentIntentId.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(paymentIntentId)
        paymentIntentId = session.payment_intent
      }
      if (paymentIntentId) {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: 'requested_by_customer',
        })
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('orders')
          .update({ status: 'refunded', refund_reason: reason || null })
          .eq('id', orderId)
          .select()
          .single()
        if (updateError) {
          console.error('Refund succeeded but order update failed:', updateError)
        }
        return Response.json({ success: true, order: updatedOrder || null })
      }
    }

    // PayPal 退款（提示手动处理）
    if (order.payment_method === 'paypal') {
      return Response.json({
        success: false,
        error: `PayPal 订单请手动退款。Payment ID：${order.payment_intent_id}`,
      })
    }

    return Response.json({ success: false, error: '无法自动退款，请手动处理' })
  } catch (err) {
    console.error('Refund error:', err)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
