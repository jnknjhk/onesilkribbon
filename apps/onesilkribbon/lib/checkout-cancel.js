import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { getPayPalOrder } from '@/lib/paypal-payment'

export async function cancelUnpaidOrder(order, reason) {
  if (order.status === 'cancelled') return order
  if (order.status !== 'pending') throw new Error('已付款订单不能取消，请先核对付款或退款。')
  if (order.payment_method === 'stripe' && order.payment_intent_id) {
    if (!order.payment_intent_id.startsWith('cs_')) throw new Error('请先核对 Stripe 付款状态。')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    let session = await stripe.checkout.sessions.retrieve(order.payment_intent_id)
    if (session.payment_status === 'paid' || session.status === 'complete') throw new Error('Stripe 已付款或正在处理，请先核对付款。')
    if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id)
    if (session.status !== 'expired') throw new Error('无法确认付款链接已关闭，库存预留保持不变。')
  }
  if (order.payment_method === 'paypal') {
    const { data: session, error } = await supabaseAdmin.from('paypal_sessions').select('paypal_order_id')
      .eq('order_number', order.order_number).maybeSingle()
    if (error) throw error
    if (session) {
      const provider = await getPayPalOrder(session.paypal_order_id)
      if (provider.status === 'COMPLETED' || provider.purchase_units?.some(u => u.payments?.captures?.length)) {
        throw new Error('PayPal 已有收款记录，请先核对付款。')
      }
    }
  }
  const { data, error } = await supabaseAdmin.rpc('release_checkout_reservation', {
    p_order_number: order.order_number, p_reason: reason || '已关闭未付款订单',
  })
  if (error) throw error
  return data
}
