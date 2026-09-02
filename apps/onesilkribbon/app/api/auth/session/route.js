import { supabase, supabaseAdmin } from '@osr/core/lib/supabase'
import { NextResponse } from 'next/server'
import { ensureUserProfile } from '@/lib/user-records'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''

    // 从 httpOnly cookie 读取 token
    const accessToken = getCookieValue(cookieHeader, 'sb-access-token')
    const refreshToken = getCookieValue(cookieHeader, 'sb-refresh-token')

    if (!accessToken) {
      return NextResponse.json({ user: null })
    }

    // 验证 access token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      // access token 过期，尝试用 refresh token 刷新
      if (refreshToken) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
        if (!refreshError && refreshed.session) {
          const response = NextResponse.json({
            user: {
              id: refreshed.user.id,
              email: refreshed.user.email,
              name: refreshed.user.user_metadata?.full_name || '',
              avatar: refreshed.user.user_metadata?.avatar_url || '',
            }
          })
          // 更新 cookie
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
          }
          response.cookies.set('sb-access-token', refreshed.session.access_token, cookieOptions)
          response.cookies.set('sb-refresh-token', refreshed.session.refresh_token, cookieOptions)
          return response
        }
      }
      return NextResponse.json({ user: null })
    }

    // 同时拉取 profile 补充信息——注意 supabase.auth.getUser(token) 只是校验了 token，
    // 并不会让后续 .from() 查询带上这个用户的身份（anon client 不会自动 setSession），
    // 所以这里必须用 service role 查，不能指望 user_profiles 的 RLS 替它做权限校验。
    // maybeSingle 而不是 single：老账号可能还没有档案，single 查不到行会抛错。
    // 这里也是全站唯一每次访问都必经的登录态检查，所以顺便作为建档的兜底点——
    // 任何登录用户第一次访问站点时，档案就会被补上。
    let { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) profile = await ensureUserProfile(user)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : user.user_metadata?.full_name || '',
        avatar: profile?.avatar_url || user.user_metadata?.avatar_url || '',
        accessToken, // 返回给前端，用于后续 API 调用
      }
    })
  } catch (err) {
    console.error('Session check error:', err)
    return NextResponse.json({ user: null })
  }
}

function getCookieValue(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}
