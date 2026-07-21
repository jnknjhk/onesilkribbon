import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

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
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ items: data || [] })
  }

  const { data, error } = await supabaseAdmin
    .from('orders').select('*').order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
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
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, order: data })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin.from('orders').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
