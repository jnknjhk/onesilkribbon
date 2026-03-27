import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

function getToken(request) {
  const auth = request.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function getUser(token) {
  if (!token) return null
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error } = await client.auth.getUser(token)
  return error ? null : user
}

// GET /api/user/orders — 获取订单列表
// GET /api/user/orders?id=xxx — 获取单个订单详情（含物流）
export async function GET(request) {
  const token = getToken(request)
  const user = await getUser(token)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('id')

  if (orderId) {
    // 单个订单详情
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id) // 安全：只能查自己的订单
      .single()

    if (error || !order) return Response.json({ error: 'Order not found' }, { status: 404 })

    // 查订单商品
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    // 查物流事件
    const { data: tracking } = await supabaseAdmin
      .from('tracking_events')
      .select('*')
      .eq('order_id', orderId)
      .order('event_time', { ascending: false })

    return Response.json({ order, items: items || [], tracking: tracking || [] })
  }

  // 订单列表
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, total_gbp, created_at, shipping_name, shipping_country, tracking_number, tracking_carrier')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ orders: orders || [] })
}
