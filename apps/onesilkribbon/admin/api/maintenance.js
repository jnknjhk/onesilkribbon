// /api/admin/maintenance —— 数据维护（设置 → 数据维护）。
// 所有清理都要人工点击确认，程序不会自动删任何东西——这些数据删了就回不来。
// 未付款订单只“关闭 + 释放库存预留”，不物理删除；支付证据和历史订单都保留。
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
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
      // 过期的 PayPal 临时下单数据：正常付款后保留用于对账；只有没有支付证据的旧记录可删
      fetchAll(() => supabaseAdmin.from('paypal_sessions')
        .select('id, order_number, created_at, expires_at')
        .lt('expires_at', new Date().toISOString()).order('created_at').order('id')),
      // 没有商品明细的订单：发不了货，要人工核对。
      fetchAll(() => supabaseAdmin.from('orders').select('id, order_number, status, total_gbp, customer_email, created_at').order('id')),
      fetchAll(() => supabaseAdmin.from('order_items').select('order_id').order('id')),
    ])
    for (const r of [stalePending, expiredSessions, allOrders, items]) if (r.error) throw r.error

    const withItems = new Set(items.data.map(i => i.order_id))
    const missingItems = allOrders.data.filter(o => !withItems.has(o.id) && o.status !== 'pending')

    // 有 payment_checkouts / payment_receipts 的 session 受数据库触发器保护，
    // 不能删；不要把它们显示成“可以放心删除”。
    const sessionNumbers = expiredSessions.data.map(s => s.order_number).filter(Boolean)
    let protectedSessions = new Set()
    if (sessionNumbers.length > 0) {
      const [checkouts, receipts] = await Promise.all([
        supabaseAdmin.from('payment_checkouts').select('order_number').in('order_number', sessionNumbers),
        supabaseAdmin.from('payment_receipts').select('order_number').in('order_number', sessionNumbers),
      ])
      if (checkouts.error) throw checkouts.error
      if (receipts.error) throw receipts.error
      protectedSessions = new Set([...(checkouts.data || []), ...(receipts.data || [])].map(r => r.order_number))
    }
    const deletableSessions = expiredSessions.data.filter(s => !protectedSessions.has(s.order_number))

    return Response.json({
      staleDays: STALE_DAYS,
      stalePending: stalePending.data,
      expiredSessions: deletableSessions,
      missingItems,
    })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-maintenance-get' })
  }
}

// body: { action: 'closeOrders' | 'deleteSessions', ids: [...] }
export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { action, ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: '没有选中任何记录' }, { status: 400 })
    }

    if (action === 'closeOrders' || action === 'deleteOrders') {
      // 只能关闭待付款订单——已付款/已发货的订单是财务凭证，绝不能从这里动。
      const { data: targets, error: readErr } = await supabaseAdmin.from('orders')
        .select('id, order_number, status').in('id', ids)
      if (readErr) throw readErr
      if ((targets || []).some(o => o.status !== 'pending')) {
        return Response.json({ error: '只能关闭待付款订单，选中的里面有已付款或已发货的订单' }, { status: 400 })
      }
      if (!targets?.length) return Response.json({ success: true, closed: 0, blocked: [] })

      // 数据库函数会先检查 payment_receipts；有支付证据的订单会拒绝关闭，
      // 返回给页面让运营先核对，而不是静默取消一笔可能已经付款的订单。
      const results = []
      for (const order of targets) {
        const { data, error } = await supabaseAdmin.rpc('close_unpaid_order', {
          p_order_number: order.order_number,
          p_reason: '后台清理长期未付款订单',
        })
        if (error) results.push({ order_number: order.order_number, ok: false, error: error.message })
        else results.push({ order_number: order.order_number, ok: true, status: data?.status })
      }
      return Response.json({
        success: true,
        closed: results.filter(r => r.ok).length,
        blocked: results.filter(r => !r.ok),
      })
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
