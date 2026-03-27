import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

function getToken(request) {
  const auth = request.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function getUser(token) {
  if (!token) return null
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error } = await client.auth.getUser(token)
  return error ? null : user
}

// GET /api/user/addresses — 获取所有地址
export async function GET(request) {
  const token = getToken(request)
  const user = await getUser(token)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: addresses, error } = await supabaseAdmin
    .from('user_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ addresses })
}

// POST /api/user/addresses — 新增地址
export async function POST(request) {
  const token = getToken(request)
  const user = await getUser(token)
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

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ address }, { status: 201 })
}

// PATCH /api/user/addresses — 更新地址
export async function PATCH(request) {
  const token = getToken(request)
  const user = await getUser(token)
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

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ address })
}

// DELETE /api/user/addresses — 删除地址
export async function DELETE(request) {
  const token = getToken(request)
  const user = await getUser(token)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('user_addresses').select('user_id').eq('id', id).single()
  if (!existing || existing.user_id !== user.id)
    return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('user_addresses').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
