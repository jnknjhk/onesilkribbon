import { supabaseAdmin } from '@osr/core/lib/supabase'
import { getAuthUser as getUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'

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
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (error || !order) return Response.json({ error: 'Order not found' }, { status: 404 })

    const { data: items } = await supabaseAdmin
      .from('order_items').select('*').eq('order_id', orderId)

    const { data: tracking } = await supabaseAdmin
      .from('tracking_events').select('*').eq('order_id', orderId)
      .order('event_time', { ascending: false })

    return Response.json({ order, items: items || [], tracking: tracking || [] })
  }

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, total_gbp, created_at, shipping_name, shipping_country, tracking_number, tracking_carrier, tracking_url')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return errorResponse(error, { tag: 'user-orders-get' })
  return Response.json({ orders: orders || [] })
}
