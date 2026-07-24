import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { errorResponse } from '@/lib/api-error'

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
  // 真正的服务端分页+筛选需要同步改造前端筛选逻辑，这里先加一个安全上限
  const { data, error } = await supabaseAdmin
    .from('orders').select('*').order('created_at', { ascending: false }).limit(2000)
  if (error) return errorResponse(error, { tag: 'admin-orders-get' })
  return Response.json({ orders: data || [] })
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
