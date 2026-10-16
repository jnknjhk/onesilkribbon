import { reconcileStripeReservation } from '@/lib/stripe-reservations'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { getPayPalOrder } from '@/lib/paypal-payment'

export async function cancelUnpaidOrder(order, reason) {
  if (order.status === 'cancelled') return order
  if (order.status !== 'pending') throw new Error('已付款订单不能取消，请先核对付款或退款。')
  if (order.payment_method === 'stripe') {
    const result = await reconcileStripeReservation(order.order_number, { cancel: true })
    if (result.status !== 'cancelled') throw new Error('Stripe 已付款或仍待核对，不能取消。')
    const { data, error } = await supabaseAdmin.from('orders').select('*').eq('order_number',order.order_number).single()
    if (error) throw error
    return data
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
