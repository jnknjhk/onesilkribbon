// /api/admin/coupons —— 优惠码。两个站共用
//   GET                                      全部优惠码
//   POST { action:'create'|'update', payload, id? }
//   PATCH { id, active }                     启用 / 停用
//   DELETE { id }
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'

// 以前优惠码重复时，前端想靠错误文字里的 "unique" 判断，但错误文字早就被统一隐藏了，
// 结果只会显示"出错了"。改成按数据库错误码判断
function dbError(error, tag) {
  if (error.code === '23505') return Response.json({ error: '这个优惠码已经存在' }, { status: 409 })
  return errorResponse(error, { tag })
}

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('coupons').select('*').order('created_at', { ascending: false })
  if (error) return errorResponse(error, { tag: 'admin-coupons-get' })
  return Response.json({ coupons: data || [] })
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { action, payload, id } = await req.json()
    if (action === 'create') {
      const { error } = await supabaseAdmin.from('coupons').insert(payload)
      if (error) return dbError(error, 'admin-coupons-create')
      return Response.json({ success: true })
    }
    if (action === 'update') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      const { error } = await supabaseAdmin.from('coupons').update(payload).eq('id', id)
      if (error) return dbError(error, 'admin-coupons-update')
      return Response.json({ success: true })
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-coupons-post' })
  }
}

export async function PATCH(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, active } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin.from('coupons').update({ active }).eq('id', id)
    if (error) return errorResponse(error, { tag: 'admin-coupons-patch' })
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-coupons-patch' })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin.from('coupons').delete().eq('id', id)
    if (error) return errorResponse(error, { tag: 'admin-coupons-delete' })
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-coupons-delete' })
  }
}
