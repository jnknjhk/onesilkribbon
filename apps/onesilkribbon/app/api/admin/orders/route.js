import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { errorResponse } from '@osr/core/lib/api-error'

const ORDERS_CAP = 2000

// GET /api/admin/orders            — 订单列表
// GET /api/admin/orders?itemsFor=<orderId> — 单个订单的商品明细
export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const itemsFor = searchParams.get('itemsFor')

  if (itemsFor) {
    const { data, error } = await supabaseAdmin
      .from('order_items').select('*').eq('order_id', itemsFor)
    if (error) return errorResponse(error, { tag: 'admin-orders-items' })
    return Response.json({ items: data || [] })
  }

  // 兜底上限，防止订单量增长后单次查询/响应体无限膨胀；管理页目前是整表拉取后前端筛选分页，
  // 真正的服务端分页+筛选需要同步改造前端筛选逻辑，这里先加一个安全上限。
  // 同时带上精确总数：触顶时最老的订单会静默消失（页面不报错、搜索也搜不到），
  // 前端靠 total > limit 显示提示，好让"该上服务端分页了"这件事被看见。
  const { data, error, count } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(ORDERS_CAP)
  if (error) return errorResponse(error, { tag: 'admin-orders-get' })
  return Response.json({
    orders: data || [],
    total:  count ?? (data || []).length,
    limit:  ORDERS_CAP,
  })
}

// PATCH /api/admin/orders — { id, action:'cancel', reason }
export async function PATCH(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, action, reason } = await req.json()
    if (!id || !action) return Response.json({ error: 'Missing id/action' }, { status: 400 })

    if (action === 'cancel') {
      const { data, error } = await supabaseAdmin.from('orders').update({
        status:        'cancelled',
        cancel_reason: reason || null,
        cancelled_at:  new Date().toISOString(),
      }).eq('id', id).select().single()
      if (error) return errorResponse(error, { tag: 'admin-orders-cancel' })
      return Response.json({ success: true, order: data })
    }

    // 手动标记送达。接了 AfterShip 的话物流商说签收就会自动写 delivered_at，
    // 但没接 / 物流商不回传时需要能手动确认，否则订单永远停在"已发货"。
    if (action === 'deliver') {
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

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-orders-patch' })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin.from('orders').delete().eq('id', id)
    if (error) return errorResponse(error, { tag: 'admin-orders-delete' })
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-orders-delete' })
  }
}
