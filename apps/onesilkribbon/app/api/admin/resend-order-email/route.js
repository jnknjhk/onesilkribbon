import { isErased } from '@/admin/lib/erasure'
import { CAN } from '@/admin/lib/status'
import { verifyAdmin } from '@/admin/auth'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation } from '@/lib/email'
import { errorResponse } from '@osr/core/lib/api-error'

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { orderId } = await req.json().catch(() => ({})) || {}
    if (typeof orderId !== 'string' || !orderId || orderId.length > 100) {
      return Response.json({ error: '请提供有效的订单 ID' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders').select('*').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
    if (isErased(order) || !CAN.resend(order.status)) return Response.json({ error: '该订单无法重发确认邮件' }, { status: 409 })

    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items').select('*').eq('order_id', orderId)

    if (itemsError) throw itemsError
    if (!orderItems?.length) return Response.json({ error: '此订单缺少商品明细，无法重发确认邮件' }, { status: 409 })
    const items = orderItems.map(i => ({
      name:    i.product_name,
      skuDesc: i.sku_description || '',
      price:   parseFloat(i.unit_price_gbp),
      qty:     i.quantity,
    }))

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
    }

    const totals = {
      subtotal:    order.subtotal_gbp,
      shipping:    order.shipping_gbp,
      discount:    order.discount_gbp,
      total:       order.total_gbp,
      freeShipping: parseFloat(order.shipping_gbp) === 0,
    }

    await sendOrderConfirmation({ order, items, form, totals })

    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-resend-order-email' })
  }
}
