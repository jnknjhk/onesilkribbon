// /api/admin/dashboard —— 工作台数据，两个站共用
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { REVENUE_STATUSES } from '../lib/status'
import { fetchAll, dayKey, readSettings } from './_helpers'

export const DEFAULT_LOW_STOCK = 3
const OVERDUE_DAYS = 2

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const [ordersRes, skusRes, productsRes, itemsRes, settings, failedRes] = await Promise.all([
      // 只取统计用到的几列，分页取完——不能截断，否则营收会悄悄算少
      fetchAll(o => supabaseAdmin.from('orders')
        .select('id, order_number, status, total_gbp, created_at, paid_at, customer_email, shipping_name', o)
        .order('created_at', { ascending: false }).order('id', { ascending: false })),
      fetchAll(o => supabaseAdmin.from('product_skus')
        .select('id, product_id, stock_qty, is_active', o).order('id')),
      fetchAll(o => supabaseAdmin.from('products').select('id, is_active', o).order('id')),
      fetchAll(o => supabaseAdmin.from('order_items').select('order_id', o).order('order_id')),
      readSettings(supabaseAdmin, ['low_stock_threshold']),
      supabaseAdmin.from('email_log').select('id', { count: 'exact', head: true })
        .eq('status', 'failed').gte('created_at', sevenDaysAgo),
    ])
    if (ordersRes.error) return errorResponse(ordersRes.error, { tag: 'admin-dashboard-orders' })

    const orders = ordersRes.data
    const threshold = Number.isFinite(parseInt(settings.low_stock_threshold, 10))
      ? parseInt(settings.low_stock_threshold, 10) : DEFAULT_LOW_STOCK

    // ── 待办 ──
    const toShip = orders.filter(o => o.status === 'paid')
    const overdueCutoff = Date.now() - OVERDUE_DAYS * 86400000
    const toShipOverdue = toShip.filter(o => new Date(o.paid_at || o.created_at).getTime() < overdueCutoff).length

    const activeProducts = new Set(productsRes.data.filter(p => p.is_active !== false).map(p => p.id))
    const lowStock = skusRes.data.filter(s =>
      s.is_active !== false && activeProducts.has(s.product_id) && (s.stock_qty ?? 0) <= threshold
    ).length

    // 已付款却没有商品明细的订单：发不了货，需要人工核对
    const withItems = new Set(itemsRes.data.map(i => i.order_id))
    const needsReview = orders.filter(o => REVENUE_STATUSES.includes(o.status) && !withItems.has(o.id)).length

    // ── 销售（按英国时间的自然日） ──
    const today = dayKey(Date.now())
    const d7 = dayKey(Date.now() - 6 * 86400000)
    const d30 = dayKey(Date.now() - 29 * 86400000)
    const sales = { today: { revenue: 0, orders: 0 }, d7: { revenue: 0, orders: 0 }, d30: { revenue: 0, orders: 0 }, all: { revenue: 0, orders: 0 } }
    for (const o of orders) {
      if (!REVENUE_STATUSES.includes(o.status)) continue
      const amount = parseFloat(o.total_gbp) || 0
      const k = dayKey(o.created_at)
      const add = b => { b.revenue += amount; b.orders += 1 }
      add(sales.all)
      if (k >= d30) add(sales.d30)
      if (k >= d7) add(sales.d7)
      if (k === today) add(sales.today)
    }
    for (const b of Object.values(sales)) b.revenue = Math.round(b.revenue * 100) / 100

    return Response.json({
      todo: {
        toShip: toShip.length,
        toShipOverdue,
        lowStock,
        lowStockThreshold: threshold,
        needsReview,
        // 邮件记录表只有部分站点有，没有就是 null（前端不显示这一项）
        failedEmails: failedRes.error ? null : (failedRes.count || 0),
      },
      sales,
      productsActive: activeProducts.size,
      recent: orders.slice(0, 6),
    })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-dashboard' })
  }
}
