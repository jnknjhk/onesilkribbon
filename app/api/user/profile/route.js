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

// GET /api/user/profile
export async function GET(request) {
  const token = getToken(request)
  const user = await getUser(token)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ profile })
}

// PATCH /api/user/profile
export async function PATCH(request) {
  const token = getToken(request)
  const user = await getUser(token)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { first_name, last_name, phone } = body

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .update({ first_name, last_name, phone, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ profile })
}
