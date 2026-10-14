import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { errorResponse } from '@osr/core/lib/api-error'
import { completeOrder, deliverNotifications } from '@/lib/payment-orders'
import { recoverPayPal } from '@/lib/paypal-payment'

export async function GET() {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const [receipts, notifications, pendingPayPal] = await Promise.all([
    supabaseAdmin.from('payment_receipts').select('provider,payment_id,order_number,created_at')
      .is('processed_at', null).order('created_at').limit(100),
    supabaseAdmin.from('payment_notifications').select('order_number,customer_sent_at,owner_sent_at')
      .or('customer_sent_at.is.null,owner_sent_at.is.null').order('created_at').limit(100),
    supabaseAdmin.from('orders').select('order_number,created_at')
      .eq('payment_method', 'paypal').eq('status', 'pending').order('created_at').limit(100),
  ])
  if (receipts.error || notifications.error || pendingPayPal.error) return errorResponse(receipts.error || notifications.error || pendingPayPal.error)
  return Response.json({ receipts: receipts.data, notifications: notifications.data, pendingPayPal: pendingPayPal.data })
}

export async function POST(req) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { orderNumber } = await req.json()
    if (typeof orderNumber !== 'string' || !orderNumber) return Response.json({ error: 'Missing order number' }, { status: 400 })
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
