import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

// GET /api/admin/dashboard — 后台首页统计数据
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: recentOrders } = await supabaseAdmin
    .from('orders')
    .select('id, total_gbp, status, created_at, customer_email')
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: orderCount } = await supabaseAdmin
    .from('orders').select('*', { count: 'exact', head: true })

  const { data: allEmailData } = await supabaseAdmin.from('orders').select('customer_email')
  const customerCount = new Set((allEmailData || []).map(o => o.customer_email).filter(Boolean)).size

  const { data: revenueData } = await supabaseAdmin
    .from('orders').select('total_gbp, status').in('status', ['paid', 'shipped', 'refunded'])
  const revenue = (revenueData || []).reduce((s, o) => o.status !== 'refunded' ? s + (parseFloat(o.total_gbp) || 0) : s, 0)

  const { count: productCount } = await supabaseAdmin
    .from('products').select('*', { count: 'exact', head: true }).eq('is_active', true)

  const { data: allOrders } = await supabaseAdmin.from('orders').select('status')
  const pending = (allOrders || []).filter(o => o.status === 'pending').length

  return Response.json({
    orders:       orderCount || 0,
    revenue,
    products:     productCount || 0,
    customers:    customerCount || 0,
    pending,
    recentOrders: recentOrders || [],
  })
}
