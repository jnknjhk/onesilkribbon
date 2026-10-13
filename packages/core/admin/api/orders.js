// /api/admin/orders —— 两个站共用的订单接口（站点的 route.js 只是转出这里的 GET / PATCH）
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { ORDER_TABS, DEFAULT_ORDER_TAB, tabStatuses, CAN } from '../lib/status'
import { cleanSearch } from './_helpers'

const MAX_PAGE_SIZE = 100

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

// 每个页签有多少单（页签上的数字、侧边栏"待发货"角标）
async function tabCounts() {
  const entries = await Promise.all(ORDER_TABS.map(async t => {
    let q = supabaseAdmin.from('orders').select('id', { count: 'exact', head: true })
    if (t.statuses) q = q.in('status', t.statuses)
    const { count } = await q
    return [t.key, count || 0]
  }))
  return Object.fromEntries(entries)
}

// PostgREST 能顺着外键把子表一起带出来，一次往返拿齐订单和它的商品/物流。
// 万一线上库里这几张表之间没建外键，会报 PGRST200，这时退回分开查（多一次往返，但结果一样）
const noRelation = e => !!e && (e.code === 'PGRST200' || /relationship/i.test(e.message || ''))

// 列表每一行带上"买了什么"的简短描述，不用点进去就知道要拿什么货
function withSummary(o, list) {
  const qty = list.reduce((n, i) => n + (i.quantity || 0), 0)
  const first = list[0]
  return {
    ...o,
    item_count: qty,
    item_summary: first
      ? `${first.product_name}${first.sku_description ? ' · ' + first.sku_description : ''} ×${first.quantity}${list.length > 1 ? ` 等 ${list.length} 种` : ''}`
      : '',
  }
}

async function attachItemSummary(orders) {
  const ids = orders.map(o => o.id)
  if (ids.length === 0) return orders
  const { data: items } = await supabaseAdmin
    .from('order_items').select('order_id, product_name, sku_description, quantity').in('order_id', ids)
  const byOrder = {}
  for (const it of items || []) (byOrder[it.order_id] ||= []).push(it)
  return orders.map(o => withSummary(o, byOrder[o.id] || []))
}

const byEventTime = (a, b) => String(a.event_time || '').localeCompare(String(b.event_time || ''))

async function orderDetail(number) {
  // 邮件记录按订单号查，不用等订单查完，一起发出去
  const emailsQ = supabaseAdmin.from('email_log').select('id, kind, to_email, subject, status, error, created_at')
    .eq('order_number', number).order('created_at', { ascending: true })
  const [embedded, emailsRes] = await Promise.all([
    supabaseAdmin.from('orders').select('*, order_items(*), tracking_events(*)').eq('order_number', number).maybeSingle(),
    emailsQ,
  ])
  let order, items, events
  if (!embedded.error) {
    if (embedded.data) {
      ;({ order_items: items, tracking_events: events, ...order } = embedded.data)
    }
  } else if (noRelation(embedded.error)) {
    const r = await supabaseAdmin.from('orders').select('*').eq('order_number', number).maybeSingle()
    if (r.error) return errorResponse(r.error, { tag: 'admin-order-detail' })
    order = r.data
    if (order) {
      const [a, b] = await Promise.all([
        supabaseAdmin.from('order_items').select('*').eq('order_id', order.id),
        supabaseAdmin.from('tracking_events').select('*').eq('order_id', order.id),
      ])
      items = a.data; events = b.data
    }
  } else {
    return errorResponse(embedded.error, { tag: 'admin-order-detail' })
  }
  if (!order) return Response.json({ error: '找不到这个订单' }, { status: 404 })
  return Response.json({
    order,
    items: items || [],
    events: [...(events || [])].sort(byEventTime),
    // 邮件记录表只有部分站点有；查不到就当没有，不影响订单本身
    emails: emailsRes?.error ? null : (emailsRes?.data || []),
  })
}

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return unauthorized()

  try {
    const { searchParams } = new URL(req.url)

    if (searchParams.get('countsOnly')) {
      return Response.json({ counts: await tabCounts() })
    }

    // 旧接口：单个订单的商品明细（保留兼容）
    const itemsFor = searchParams.get('itemsFor')
    if (itemsFor) {
      const { data, error } = await supabaseAdmin.from('order_items').select('*').eq('order_id', itemsFor)
      if (error) return errorResponse(error, { tag: 'admin-orders-items' })
      return Response.json({ items: data || [] })
    }

    const number = searchParams.get('number')
    if (number) return orderDetail(number)

    // 打印装箱单：一次取多张订单和各自的商品
    const numbers = searchParams.get('numbers')
    if (numbers) {
      const list = numbers.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
      let { data: orders, error } = await supabaseAdmin.from('orders').select('*, order_items(*)').in('order_number', list)
      if (noRelation(error)) {
        ;({ data: orders, error } = await supabaseAdmin.from('orders').select('*').in('order_number', list))
        if (!error) {
          const ids = (orders || []).map(o => o.id)
          const { data: items } = ids.length
            ? await supabaseAdmin.from('order_items').select('*').in('order_id', ids)
            : { data: [] }
          orders = (orders || []).map(o => ({ ...o, order_items: (items || []).filter(i => i.order_id === o.id) }))
        }
      }
      if (error) return errorResponse(error, { tag: 'admin-orders-print' })
      // 按请求里的顺序返回
      const map = Object.fromEntries((orders || []).map(({ order_items, ...o }) => [o.order_number, { ...o, items: order_items || [] }]))
      return Response.json({ orders: list.map(n => map[n]).filter(Boolean) })
    }

    // 列表：服务端分页 + 筛选 + 搜索（以前是一次拉 2000 条在浏览器里筛，超出的订单直接看不到）
    const tab = ORDER_TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : DEFAULT_ORDER_TAB
    const q = cleanSearch(searchParams.get('q'))
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize'), 10) || 30))
    const from = (page - 1) * pageSize

    const listQuery = columns => {
      let query = supabaseAdmin.from('orders').select(columns, { count: 'exact' })
      const statuses = tabStatuses(tab)
      if (statuses) query = query.in('status', statuses)
      if (q) query = query.or(`order_number.ilike.%${q}%,customer_email.ilike.%${q}%,shipping_name.ilike.%${q}%`)
      // 待发货按"等得最久的在前"，其它按最新在前
      query = tab === 'to_ship'
        ? query.order('created_at', { ascending: true }).order('id', { ascending: true })
        : query.order('created_at', { ascending: false }).order('id', { ascending: false })
      return query.range(from, from + pageSize - 1)
    }

    // 订单和"买了什么"一次取回；页签数字同时查
    let [{ data, error, count }, counts] = await Promise.all([
      listQuery('*, order_items(product_name, sku_description, quantity)'),
      tabCounts(),
    ])
    let rows
    if (noRelation(error)) {
      ;({ data, error, count } = await listQuery('*'))
      if (!error) rows = await attachItemSummary(data || [])
    } else if (!error) {
      rows = (data || []).map(({ order_items, ...o }) => withSummary(o, order_items || []))
    }
    if (error) return errorResponse(error, { tag: 'admin-orders-list' })

    const total = count || 0
    return Response.json({
      orders: rows,
      total, page, pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      tab, counts,
    })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-orders-get' })
  }
}

// PATCH /api/admin/orders — { id, action: 'cancel' | 'deliver' | 'note', reason?, notes? }
export async function PATCH(req) {
  const admin = await verifyAdmin()
  if (!admin) return unauthorized()

  try {
    const { id, action, reason, notes } = await req.json()
    if (!id || !action) return Response.json({ error: 'Missing id/action' }, { status: 400 })

    const { data: current, error: readErr } = await supabaseAdmin
      .from('orders').select('id, status, tracking_number, tracking_carrier, shipping_city').eq('id', id).maybeSingle()
    if (readErr) return errorResponse(readErr, { tag: 'admin-orders-read' })
    if (!current) return Response.json({ error: '找不到这个订单' }, { status: 404 })

    if (action === 'cancel') {
      // 只有没付款的订单能直接取消。已付款的必须走退款——以前这里不拦，
      // 取消后钱还在账上、订单却显示"已取消"
      if (!CAN.cancel(current.status)) {
        return Response.json({ error: '已付款的订单不能直接取消，请使用"退款"' }, { status: 409 })
      }
      const { data, error } = await supabaseAdmin.from('orders').update({
        status:        'cancelled',
        cancel_reason: reason || null,
        cancelled_at:  new Date().toISOString(),
      }).eq('id', id).eq('status', current.status).select().single()
      if (error) return errorResponse(error, { tag: 'admin-orders-cancel' })
      return Response.json({ success: true, order: data })
    }

    // 手动标记送达。接了 AfterShip 的话物流商说签收就会自动写 delivered_at，
    // 但没接 / 物流商不回传时需要能手动确认，否则订单永远停在"已发货"。
    if (action === 'deliver') {
      if (!CAN.deliver(current.status)) {
        return Response.json({ error: '只有已发货的订单才能标记送达' }, { status: 409 })
      }
      const deliveredAt = new Date().toISOString()
      const { data, error } = await supabaseAdmin.from('orders').update({
        status:       'delivered',
        delivered_at: deliveredAt,
      }).eq('id', id).select().single()
      if (error) return errorResponse(error, { tag: 'admin-orders-deliver' })

      await supabaseAdmin.from('tracking_events').insert({
        order_id:        id,
        tracking_number: data.tracking_number || null,
        carrier:         data.tracking_carrier || null,
        status:          'Delivered',
        message:         '已确认送达（后台手动标记）',
        location:        data.shipping_city || null,
        event_time:      deliveredAt,
      })
      return Response.json({ success: true, order: data })
    }

    // 内部备注（orders.notes，只有后台看得到）
    if (action === 'note') {
      const text = String(notes ?? '').slice(0, 4000)
      const { data, error } = await supabaseAdmin.from('orders')
        .update({ notes: text || null }).eq('id', id).select().single()
      if (error) return errorResponse(error, { tag: 'admin-orders-note' })
      return Response.json({ success: true, order: data })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-orders-patch' })
  }
}
