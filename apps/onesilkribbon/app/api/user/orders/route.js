import { supabaseAdmin } from '@osr/core/lib/supabase'
import { getAuthUser as getUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'

// Customer responses must never include internal notes or payment provider IDs.
const ORDER_FIELDS = 'id,order_number,status,subtotal_gbp,vat_amount_gbp,shipping_gbp,total_gbp,created_at,shipping_name,shipping_line1,shipping_line2,shipping_city,shipping_postcode,shipping_country,payment_method,tracking_number,tracking_carrier,tracking_url,shipped_at,delivered_at'
const reply = data => Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } })

// GET /api/user/orders — 获取订单列表
// GET /api/user/orders?id=xxx — 获取单个订单详情（含物流）
export async function GET(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('id')

  if (orderId) {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return errorResponse(error, { tag: 'user-order-detail' })
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items').select('id,product_name,sku_description,quantity,unit_price_gbp,line_total_gbp').eq('order_id', orderId)
    if (itemsError) return errorResponse(itemsError, { tag: 'user-order-items' })

    const { data: tracking, error: trackingError } = await supabaseAdmin
      .from('tracking_events').select('id,status,message,location,event_time').eq('order_id', orderId)
      .order('event_time', { ascending: false })
    if (trackingError) return errorResponse(trackingError, { tag: 'user-order-tracking' })

    return reply({ order, items: items || [], tracking: tracking || [] })
  }

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, total_gbp, created_at, shipping_name, shipping_country, tracking_number, tracking_carrier, tracking_url')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return errorResponse(error, { tag: 'user-orders-get' })
  return reply({ orders: orders || [] })
}
