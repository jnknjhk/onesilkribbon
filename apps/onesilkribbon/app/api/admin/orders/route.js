import { PATCH as updateOrder } from '@osr/core/admin/api/orders'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { cancelUnpaidOrder } from '@/lib/checkout-cancel'
export { GET } from '@osr/core/admin/api/orders'

export async function PATCH(req) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.clone().json()
  if (body.action !== 'cancel') return updateOrder(req)
  try {
    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', body.id).single()
    if (error) throw error
    return Response.json({ success: true, order: await cancelUnpaidOrder(order, body.reason) })
  } catch (err) {
    console.error('Cancel checkout failed', err)
    return Response.json({ error: '取消未完成：请核对付款状态后重试，库存预留保持安全。' }, { status: 409 })
  }
}
