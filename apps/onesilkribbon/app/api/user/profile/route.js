import { supabaseAdmin } from '@osr/core/lib/supabase'
import { getAuthUser as getUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'

// GET /api/user/profile
export async function GET(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return errorResponse(error, { tag: 'user-profile-get' })
  return Response.json({ profile })
}

// PATCH /api/user/profile
export async function PATCH(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { first_name, last_name, phone } = body

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .update({ first_name, last_name, phone, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (error) return errorResponse(error, { tag: 'user-profile-update' })
  return Response.json({ profile })
}
