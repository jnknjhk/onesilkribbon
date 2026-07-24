import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { errorResponse } from '@/lib/api-error'

// GET /api/admin/customers — 按邮箱聚合出的客户列表（供客户管理页 + 发送邮件页复用）
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 兜底上限，防止订单量增长后这里的整表聚合无限膨胀
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('customer_email, shipping_name, shipping_city, shipping_country, total_gbp, created_at, status, user_id')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) return errorResponse(error, { tag: 'admin-customers-get' })

  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, first_name, last_name, avatar_url, created_at')

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const map = {}
  ;(orders || []).forEach(o => {
    const email = o.customer_email || 'unknown'
    if (!map[email]) {
      map[email] = {
        email,
        name: o.shipping_name,
        city: o.shipping_city,
        country: o.shipping_country,
        orders: 0,
        spent: 0,
        lastOrder: o.created_at,
        user_id: o.user_id || null,
        profile: o.user_id ? profileMap[o.user_id] : null,
      }
    }
    map[email].orders++
    map[email].spent += parseFloat(o.total_gbp || 0)
    if (o.created_at > map[email].lastOrder) map[email].lastOrder = o.created_at
    if (o.user_id && !map[email].user_id) {
      map[email].user_id = o.user_id
      map[email].profile = profileMap[o.user_id] || null
    }
  })

  const customers = Object.values(map).sort((a, b) => b.spent - a.spent)
  return Response.json({ customers })
}
