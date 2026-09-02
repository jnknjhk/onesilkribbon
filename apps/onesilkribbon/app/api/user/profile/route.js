import { supabaseAdmin } from '@osr/core/lib/supabase'
import { getAuthUser as getUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'
import { ensureUserProfile } from '@/lib/user-records'

// GET /api/user/profile
export async function GET(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 之前这里直接 .single() 查档案，而档案从来没被创建过——
  // 查不到行会抛 "Cannot coerce the result to a single JSON object"，
  // 客户的"编辑资料"页因此对所有人都是报错的。改成没有就建一条。
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return errorResponse(error, { tag: 'user-profile-get' })
  if (profile) return Response.json({ profile })

  const created = await ensureUserProfile(user)
  if (!created) return errorResponse(new Error('failed to create profile'), { tag: 'user-profile-create' })
  return Response.json({ profile: created })
}

// PATCH /api/user/profile
export async function PATCH(request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { first_name, last_name, phone } = body

  // upsert 而不是 update：档案可能还不存在（老账号），update 会静默更新 0 行，
  // 客户会以为保存成功了其实什么都没写进去
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      id: user.id,
      email: user.email,
      first_name, last_name, phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()

  if (error) return errorResponse(error, { tag: 'user-profile-update' })
  return Response.json({ profile })
}
