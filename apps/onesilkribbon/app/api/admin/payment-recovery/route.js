import { verifyAdmin } from '@/admin/auth'
import { fetchAll, isMissingRelation } from '@/admin/api/_helpers'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { errorResponse } from '@osr/core/lib/api-error'
import { completeOrder, deliverNotifications } from '@/lib/payment-orders'
import { recoverPayPal } from '@/lib/paypal-payment'
import { reconcileStripeReservation } from '@/lib/stripe-reservations'

export async function GET() {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const [receipts, notifications, pendingPayPal, pendingStripe, pendingRefunds, unprocessedRefunds, refundedOrders, refundRequests, paymentRefunds, disputes] = await Promise.all([
    supabaseAdmin.from('payment_receipts').select('provider,payment_id,order_number,created_at')
      .is('processed_at', null).order('created_at').limit(100),
    supabaseAdmin.from('payment_notifications').select('order_number,customer_sent_at,owner_sent_at')
      .or('customer_sent_at.is.null,owner_sent_at.is.null').order('created_at').limit(100),
    supabaseAdmin.from('orders').select('order_number,created_at')
      .eq('payment_method', 'paypal').eq('status', 'pending').order('created_at').limit(100),
    supabaseAdmin.from('orders').select('order_number,created_at')
      .eq('payment_method', 'stripe').eq('status', 'pending').order('created_at').limit(100),
    // 后台发起、但还没完成的退款（自动退款待确认 / 手动退款待补记）
    supabaseAdmin.from('refund_requests')
      .select('order_id, manual, restock, reason, provider_id, provider_status, created_at, orders(order_number, status, total_gbp, payment_method)')
      .is('completed_at', null).order('created_at').limit(100),
    // 支付平台已经回传退款、但本地还没确认处理的记录
    supabaseAdmin.from('payment_refunds')
      .select('provider, refund_id, order_number, amount_pence, currency, full_refund, created_at')
      .is('processed_at', null).order('created_at').limit(100),
    // 已退款订单与退款记录对账：找出状态是 refunded、但没有任何退款记录的订单
    fetchAll(() => supabaseAdmin.from('orders')
      .select('id, order_number, total_gbp, payment_method, refund_reason, created_at')
      .eq('status', 'refunded').order('created_at', { ascending: false }).order('id')),
    fetchAll(() => supabaseAdmin.from('refund_requests').select('order_id').order('order_id')),
    fetchAll(() => supabaseAdmin.from('payment_refunds').select('order_number').order('order_number')),
    // 支付平台拒付/争议：不自动改订单状态，单独列出让店主去支付平台应诉。
    supabaseAdmin.from('payment_disputes')
      .select('provider, dispute_id, order_number, payment_id, status, reason, amount_pence, currency, evidence_due_by, opened_at, updated_at, resolved_at')
      .order('updated_at', { ascending: false }).limit(100),
  ])
  // 代码可能先于迁移上线：争议表不存在时不影响其它恢复数据。
  if (isMissingRelation(disputes.error)) { disputes.error = null; disputes.data = [] }
  const failed = [receipts, notifications, pendingPayPal, pendingStripe, pendingRefunds, unprocessedRefunds, refundedOrders, refundRequests, paymentRefunds, disputes].find(r => r.error)
  if (failed) return errorResponse(failed.error)

  const withRefundRequest = new Set((refundRequests.data || []).map(r => r.order_id))
  const withPaymentRefund = new Set((paymentRefunds.data || []).map(r => r.order_number))
  const refundedWithoutRecord = (refundedOrders.data || []).filter(o =>
    !withRefundRequest.has(o.id) && !withPaymentRefund.has(o.order_number)
  )

  return Response.json({
    receipts: receipts.data,
    notifications: notifications.data,
    pendingPayPal: pendingPayPal.data,
    pendingStripe: pendingStripe.data,
    pendingRefunds: pendingRefunds.data,
    unprocessedRefunds: unprocessedRefunds.data,
    refundedWithoutRecord,
    disputes: disputes.data || [],
  })
}

export async function POST(req) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { orderNumber } = await req.json()
    if (typeof orderNumber !== 'string' || !orderNumber) return Response.json({ error: 'Missing order number' }, { status: 400 })
    const { data: order, error: orderError } = await supabaseAdmin.from('orders').select('payment_method,status')
      .eq('order_number',orderNumber).single()
    if (orderError) throw orderError
    if (order.payment_method === 'stripe' && order.status === 'pending') {
      // Preserve the original recovery path for durable, already-verified receipts,
      // including historical orders that never had a checkout-attempt record.
      const { data: savedReceipts, error: receiptError } = await supabaseAdmin.from('payment_receipts')
        .select('provider,payment_id').eq('order_number',orderNumber).is('processed_at',null)
      if (receiptError) throw receiptError
      if (savedReceipts?.length) {
        for (const receipt of savedReceipts) await completeOrder(receipt.provider,receipt.payment_id)
        await deliverNotifications(orderNumber)
        return Response.json({success:true})
      }
      const result = await reconcileStripeReservation(orderNumber)
      return Response.json({ success: true, pending: result.status === 'pending' })
    }
    const { data: session, error } = await supabaseAdmin.from('paypal_sessions').select('paypal_order_id')
      .eq('order_number', orderNumber).maybeSingle()
    if (error) throw error
    if (session) {
      // Reconciliation only retrieves payment state: never initiates a new capture.
      await recoverPayPal(orderNumber, session.paypal_order_id, { capture: false })
    } else {
      const { data: receipts, error: readError } = await supabaseAdmin.from('payment_receipts')
        .select('provider,payment_id').eq('order_number', orderNumber).is('processed_at', null)
      if (readError) throw readError
      for (const receipt of receipts || []) await completeOrder(receipt.provider, receipt.payment_id)
      await deliverNotifications(orderNumber)
    }
    return Response.json({ success: true })
  } catch (err) { return errorResponse(err, { status: 503, tag: 'payment-recovery' }) }
}
