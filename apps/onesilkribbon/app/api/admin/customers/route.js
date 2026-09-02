import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { errorResponse } from '@osr/core/lib/api-error'

// 内存聚合退路的兜底上限（见下方 aggregateInMemory 的注释）
const FALLBACK_CAP = 5000

// GET /api/admin/customers — 按邮箱聚合出的客户列表（供客户管理页 + 发送邮件页复用）
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, first_name, last_name, avatar_url, created_at')
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // 首选：在数据库里 group by 聚合。整表参与统计，不受任何行数上限影响，
  // 也不用把几千行订单拉到 Node 里再算一遍。
  const { data: rows, error } = await supabaseAdmin
    .from('customer_summary')
    .select('*')
    .order('spent', { ascending: false })

  if (!error) {
    return Response.json({
      customers: (rows || []).map(r => ({
        email:     r.email,
        name:      r.name,
        city:      r.city,
        country:   r.country,
        orders:    r.orders,
        spent:     Number(r.spent || 0),
        lastOrder: r.last_order,
        user_id:   r.user_id || null,
        profile:   r.user_id ? profileMap[r.user_id] || null : null,
      })),
    })
  }

  // 视图还没建（迁移脚本没跑）时才退回旧实现；其它错误照常上报，别被这条退路吞掉
  if (!/does not exist|schema cache/i.test(error.message || '')) {
    return errorResponse(error, { tag: 'admin-customers-view' })
  }
  return aggregateInMemory(profileMap)
}

// 旧的内存聚合实现，只在 customer_summary 视图不存在时使用。
// 它有一个无法回避的缺陷：只能看到最近 FALLBACK_CAP 笔订单，超出部分不参与聚合，
// 于是老客户的"累计消费/订单数"会算少。所以这条路会带上 degraded 标记，
// 让页面明确提示这份数字可能不准，而不是装作一切正常。
async function aggregateInMemory(profileMap) {
  const { data: orders, error, count } = await supabaseAdmin
    .from('orders')
    .select(
      'customer_email, shipping_name, shipping_city, shipping_country, total_gbp, created_at, status, user_id',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .limit(FALLBACK_CAP)

  if (error) return errorResponse(error, { tag: 'admin-customers-get' })

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

  return Response.json({
    customers: Object.values(map).sort((a, b) => b.spent - a.spent),
    degraded: true,
    total: count ?? (orders || []).length,
    limit: FALLBACK_CAP,
  })
}
