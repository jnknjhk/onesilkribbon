import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function getUser(request) {
  // 方式1：Authorization header（客户端直接传 token）
  const auth = request.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) return user
  }

  // 方式2：SSR cookie（@supabase/ssr 存的）
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!error && user) return user

  return null
}

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

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ orders: orders || [] })
}
