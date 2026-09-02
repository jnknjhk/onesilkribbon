import { supabaseAdmin } from '@osr/core/lib/supabase'

// 注册客户的档案与地址落库。
//
// 背景：user_profiles 之前从来没有被创建过——profile 接口只有 update 没有 insert，
// 注册流程也不建档。结果是 5 个注册账号对应 0 条档案，客户点"编辑资料"直接报错
// （.single() 查不到行会抛错），后台客户列表也看不到姓名电话。

// 确保某个登录用户有一条 user_profiles 记录，返回这条记录。
// 用 upsert 而不是"先查再插"，避免并发下重复插入。
export async function ensureUserProfile(user) {
  if (!user?.id) return null

  const meta = user.user_metadata || {}
  // Google 登录给的是 full_name / name，邮箱注册可能什么都没有
  const fullName = meta.full_name || meta.name || ''
  const [firstFromMeta, ...restFromMeta] = fullName.trim().split(/\s+/)

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      id:         user.id,
      email:      user.email,
      // 已有档案不要被这里的默认值覆盖掉——onConflict 只在插入时用到这些值，
      // 但 upsert 更新时也会写，所以只在确实有值时才带上
      ...(firstFromMeta ? { first_name: firstFromMeta } : {}),
      ...(restFromMeta.length ? { last_name: restFromMeta.join(' ') } : {}),
      ...(meta.avatar_url ? { avatar_url: meta.avatar_url } : {}),
    }, { onConflict: 'id', ignoreDuplicates: false })
    .select()
    .single()

  if (error) {
    console.error('[ensureUserProfile]', error.message)
    return null
  }
  return data
}

// 下单时把客户填的收货信息补进他的账户：
//   · 档案里缺姓名/电话就补上（不覆盖客户自己填过的）
//   · 地址存进"常用地址"，下次结账自动带出
// 只对已登录用户生效；访客下单不做任何事。
//
// 整个过程失败都不应该影响下单——所以调用方不需要 await 出错处理，
// 这里自己吞掉异常。
export async function saveCheckoutDetailsToAccount({ userId, form }) {
  if (!userId || !form) return

  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles').select('first_name, last_name, phone').eq('id', userId).maybeSingle()

    const phone = form.phone ? `${form.dialCode || ''} ${form.phone}`.trim() : null
    const patch = {}
    if (!profile?.first_name && form.firstName) patch.first_name = form.firstName
    if (!profile?.last_name  && form.lastName)  patch.last_name  = form.lastName
    if (!profile?.phone      && phone)          patch.phone      = phone
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      await supabaseAdmin.from('user_profiles').update(patch).eq('id', userId)
    }

    if (!form.line1 || !form.city) return

    // 同一个地址重复下单不该越存越多，先看有没有一模一样的
    const { data: existing } = await supabaseAdmin
      .from('user_addresses')
      .select('id')
      .eq('user_id', userId)
      .eq('line1', form.line1)
      .eq('city', form.city)
      .eq('postcode', form.postcode || '')
      .maybeSingle()
    if (existing) return

    // 第一个地址自动设为默认
    const { count } = await supabaseAdmin
      .from('user_addresses').select('*', { count: 'exact', head: true }).eq('user_id', userId)

    await supabaseAdmin.from('user_addresses').insert({
      user_id:    userId,
      label:      '结账时保存',
      first_name: form.firstName || null,
      last_name:  form.lastName || null,
      line1:      form.line1,
      line2:      form.line2 || null,
      city:       form.city,
      postcode:   form.postcode || '',
      country:    form.country || 'GB',
      phone,
      is_default: (count || 0) === 0,
    })
  } catch (e) {
    // 存档失败不影响下单，记下来就好
    console.error('[saveCheckoutDetailsToAccount]', e.message)
  }
}
