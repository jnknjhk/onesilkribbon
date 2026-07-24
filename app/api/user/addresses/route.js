import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser as getUser } from '@/lib/get-auth-user'
import { errorResponse } from '@/lib/api-error'

// GET /api/user/addresses — 获取所有地址
export async function GET(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: addresses, error } = await supabaseAdmin
    .from('user_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return errorResponse(error, { tag: 'user-addresses-get' })
  return Response.json({ addresses })
}

// POST /api/user/addresses — 新增地址
export async function POST(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { label, first_name, last_name, line1, line2, city, postcode, country, phone, is_default } = body

  // 如果设为默认，先把其他地址取消默认
  if (is_default) {
    await supabaseAdmin
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
  }

  const { data: address, error } = await supabaseAdmin
    .from('user_addresses')
    .insert({ user_id: user.id, label, first_name, last_name, line1, line2, city, postcode, country, phone, is_default: !!is_default })
    .select()
    .single()

  if (error) return errorResponse(error, { tag: 'user-addresses-create' })
  return Response.json({ address }, { status: 201 })
}

// PATCH /api/user/addresses — 更新地址
export async function PATCH(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, label, first_name, last_name, line1, line2, city, postcode, country, phone, is_default } = body

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  // 确认地址属于当前用户
  const { data: existing } = await supabaseAdmin
    .from('user_addresses').select('user_id').eq('id', id).single()
  if (!existing || existing.user_id !== user.id)
    return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (is_default) {
    await supabaseAdmin
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
  }

  const { data: address, error } = await supabaseAdmin
    .from('user_addresses')
    .update({ label, first_name, last_name, line1, line2, city, postcode, country, phone, is_default: !!is_default, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse(error, { tag: 'user-addresses-update' })
  return Response.json({ address })
}

// DELETE /api/user/addresses — 删除地址
export async function DELETE(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('user_addresses').select('user_id').eq('id', id).single()
  if (!existing || existing.user_id !== user.id)
    return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('user_addresses').delete().eq('id', id)
  if (error) return errorResponse(error, { tag: 'user-addresses-delete' })
  return Response.json({ ok: true })
}
