import { supabaseAdmin } from '@osr/core/lib/supabase'
import { errorResponse } from '@osr/core/lib/api-error'
import { verifyAdmin } from '@/admin/auth'
import { isErased } from '@/admin/lib/erasure'
import { recordAdminAction } from '@/admin/lib/audit'
import { sendShippingNotification } from '@/lib/email'

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.orderId
    if (typeof orderId !== 'string' || !orderId || orderId.length > 100) {
      return Response.json({ error: '请提供有效的订单 ID' }, { status: 400 })
    }

    const { data: order, error } = await supabaseAdmin.from('orders')
      .select('id,order_number,status,customer_email,shipping_name,tracking_number,tracking_carrier,tracking_url')
      .eq('id', orderId).maybeSingle()
    if (error) throw error
    if (!order) return Response.json({ error: '未找到订单' }, { status: 404 })
    if (!['shipped', 'delivered'].includes(order.status) || isErased(order) ||
        !order.customer_email || !order.tracking_number || !order.tracking_carrier) {
      return Response.json({ error: '此订单缺少收件人或物流信息，无法重发发货通知' }, { status: 409 })
    }

    await sendShippingNotification({
      order,
      trackingNumber: order.tracking_number,
      carrier: order.tracking_carrier,
      trackingUrl: order.tracking_url,
    })
    await recordAdminAction(admin, 'order.resend_shipping_email', {
      targetType: 'order', targetId: order.order_number,
    })
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-resend-shipping-email' })
  }
}
