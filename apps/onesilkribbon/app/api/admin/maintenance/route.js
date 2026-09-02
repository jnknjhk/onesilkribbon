import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { errorResponse } from '@osr/core/lib/api-error'

// 后台「数据维护」用的接口。清理动作一律由人工点击触发，不做任何自动删除——
// 这些数据都是不可恢复的，宁可让它们堆着也不该由程序擅自处理。

const STALE_DAYS = 7 // 超过这么多天还停在 pending 的订单视为客户已放弃

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString()

    // 滞留的待付款订单：客户点了结账但没完成支付，会永远停在 pending，
    // 一直混在订单列表和客户统计里
    const { data: stalePending } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_email, total_gbp, created_at, payment_method')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .order('created_at')

    // 过期的 PayPal 临时下单数据：正常支付完成会被删除，
    // 客户中途放弃的就会留下来，没有清理机制
    const { data: expiredSessions } = await supabaseAdmin
      .from('paypal_sessions')
      .select('id, order_number, created_at, expires_at')
      .lt('expires_at', new Date().toISOString())
      .order('created_at')

    // 没有商品明细的订单：发不了货，需要人工核对
    const { data: allOrders } = await supabaseAdmin.from('orders').select('id, order_number, status, total_gbp, customer_email, created_at')
    const { data: items } = await supabaseAdmin.from('order_items').select('order_id')
    const withItems = new Set((items || []).map(i => i.order_id))
    const missingItems = (allOrders || []).filter(o => !withItems.has(o.id) && o.status !== 'pending')

    return Response.json({
      staleDays: STALE_DAYS,
      stalePending:    stalePending || [],
      expiredSessions: expiredSessions || [],
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
      // 只允许删 pending 的订单——已付款/已发货的订单是财务凭证，
      // 绝不能从这个入口批量清掉
      const { data: targets } = await supabaseAdmin
        .from('orders').select('id, status').in('id', ids)
      const notPending = (targets || []).filter(o => o.status !== 'pending')
      if (notPending.length > 0) {
        return Response.json({ error: '只能清理待付款订单，选中项里有已付款/已发货的订单' }, { status: 400 })
      }

      await supabaseAdmin.from('order_items').delete().in('order_id', ids)
      const { error } = await supabaseAdmin.from('orders').delete().in('id', ids)
      if (error) return errorResponse(error, { tag: 'admin-maintenance-delete-orders' })
      return Response.json({ success: true, deleted: ids.length })
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
