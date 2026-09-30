import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'

// 计入营收的订单状态。原来只算 paid + shipped，漏了 delivered——
// 那是本次改造新加的状态，于是把订单标记为"已送达"会让首页营收凭空变少。
const REVENUE_STATUSES = new Set(['paid', 'shipped', 'delivered'])

// GET /api/admin/dashboard — 后台首页统计数据
//
// 原来这里是 6 次**串行**查询，其中 5 次查的都是 orders 同一张表
// （最近订单、总数、全部邮箱、营收、全部状态各查一次）。每次往返 Supabase 约 450ms，
// 实测整个接口要 2.8 秒——后台首页那段明显的空白等待就是这么来的。
//
// 改成 2 次查询并行：orders 只取一次（只要 4 列），统计全在内存里算完。
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // ⚠️ 这里故意不加行数上限。总数/营收/客户数都是**聚合值**，截断会让数字静默算少——
  // 客户页之前就踩过这个坑（见 customer_summary 视图那次修复）。
  // 只取 4 个小字段，订单到几万笔都还在可接受范围；真到那个量级时，
  // 应该改成在数据库里聚合（加个视图），而不是在这里加 limit。
  const [{ data: orders }, { count: productCount }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id, total_gbp, status, created_at, customer_email')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  const rows = orders || []

  return Response.json({
    orders:    rows.length,
    revenue:   rows.reduce((s, o) => REVENUE_STATUSES.has(o.status) ? s + (parseFloat(o.total_gbp) || 0) : s, 0),
    products:  productCount || 0,
    customers: new Set(rows.map(o => o.customer_email).filter(Boolean)).size,
    pending:   rows.filter(o => o.status === 'pending').length,
    // 列表已按时间倒序，前 5 条就是最近订单，不用再单独查一次
    recentOrders: rows.slice(0, 5).map(o => ({
      id: o.id, total_gbp: o.total_gbp, status: o.status,
      created_at: o.created_at, customer_email: o.customer_email,
    })),
  })
}
