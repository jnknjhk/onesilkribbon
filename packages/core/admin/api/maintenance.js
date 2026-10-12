// /api/admin/maintenance —— 数据维护（设置 → 数据维护）。
// 所有清理都要人工点击确认，程序不会自动删任何东西——这些数据删了就回不来。
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'

const STALE_DAYS = 7 // 超过这么多天还停在待付款的订单，视为顾客已放弃

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString()
    const [stalePending, expiredSessions, allOrders, items] = await Promise.all([
      // 滞留的待付款订单：顾客点了结账但没付钱，会一直混在订单和客户统计里
      fetchAll(() => supabaseAdmin.from('orders')
        .select('id, order_number, customer_email, total_gbp, created_at, payment_method')
        .eq('status', 'pending').lt('created_at', cutoff).order('created_at').order('id')),
      // 过期的 PayPal 临时下单数据：正常付款后会删掉，顾客中途放弃的会留下
      fetchAll(() => supabaseAdmin.from('paypal_sessions')
        .select('id, order_number, created_at, expires_at')
        .lt('expires_at', new Date().toISOString()).order('created_at').order('id')),
      // 没有商品明细的订单：发不了货，要人工核对。
      // 以前这两条查询没分页，超过 1000 行后会把有明细的订单误报成"没有明细"
      fetchAll(() => supabaseAdmin.from('orders').select('id, order_number, status, total_gbp, customer_email, created_at').order('id')),
      fetchAll(() => supabaseAdmin.from('order_items').select('order_id').order('id')),
    ])
    for (const r of [stalePending, allOrders, items]) if (r.error) throw r.error
    const withItems = new Set(items.data.map(i => i.order_id))
    const missingItems = allOrders.data.filter(o => !withItems.has(o.id) && o.status !== 'pending')

    return Response.json({
      staleDays: STALE_DAYS,
      stalePending: stalePending.data,
      // paypal_sessions 表可能不存在（玻璃站），当成没有
      expiredSessions: expiredSessions.error ? [] : expiredSessions.data,
      missingItems,
    })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-maintenance-get' })
  }
}

// body: { action: 'deleteOrders' | 'deleteSessions', ids: [...] }
export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { action, ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: '没有选中任何记录' }, { status: 400 })
    }

    if (action === 'deleteOrders') {
      // 只能删待付款订单——已付款/已发货的订单是财务凭证，绝不能从这里删
      const { data: targets, error: readErr } = await supabaseAdmin.from('orders').select('id, status').in('id', ids)
      if (readErr) throw readErr
      if ((targets || []).some(o => o.status !== 'pending')) {
        return Response.json({ error: '只能清理待付款订单，选中的里面有已付款或已发货的订单' }, { status: 400 })
      }
      // 删除时再带一次 status = pending：万一刚好在这一刻付了款，这一单不会被删
      const { data: deleted, error } = await supabaseAdmin.from('orders').delete()
        .in('id', ids).eq('status', 'pending').select('id')
      if (error) {
        // 订单明细有外键约束时需要先删明细
        if (error.code !== '23503') return errorResponse(error, { tag: 'admin-maintenance-delete-orders' })
        const { data: stillPending } = await supabaseAdmin.from('orders').select('id').in('id', ids).eq('status', 'pending')
        const pendingIds = (stillPending || []).map(o => o.id)
        if (pendingIds.length) {
          await supabaseAdmin.from('order_items').delete().in('order_id', pendingIds)
          const { error: e2 } = await supabaseAdmin.from('orders').delete().in('id', pendingIds).eq('status', 'pending')
          if (e2) return errorResponse(e2, { tag: 'admin-maintenance-delete-orders' })
        }
        return Response.json({ success: true, deleted: pendingIds.length })
      }
      // 订单删了，没被外键级联删掉的明细一并清理
      const gone = (deleted || []).map(o => o.id)
      if (gone.length) await supabaseAdmin.from('order_items').delete().in('order_id', gone)
      return Response.json({ success: true, deleted: gone.length })
    }

    if (action === 'deleteSessions') {
      const { error } = await supabaseAdmin.from('paypal_sessions').delete().in('id', ids)
      if (error) return errorResponse(error, { tag: 'admin-maintenance-delete-sessions' })
      return Response.json({ success: true, deleted: ids.length })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-maintenance-post' })
  }
}
