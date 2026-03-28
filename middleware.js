import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // 只保护 /admin 路由
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const cookieHeader = request.headers.get('cookie') || ''

  // 从 cookie 读取 access token（Supabase JS SDK 存储格式）
  let accessToken = null

  // 尝试读取 sb-access-token（我们自定义的 cookie）
  const match = cookieHeader.match(/sb-access-token=([^;]+)/)
  if (match) accessToken = decodeURIComponent(match[1])

  // 也尝试读取 Supabase SDK 默认的 storage key
  if (!accessToken) {
    const sbMatch = cookieHeader.match(/sb-[a-z]+-auth-token=([^;]+)/)
    if (sbMatch) {
      try {
        const decoded = decodeURIComponent(sbMatch[1])
        const parsed = JSON.parse(decoded)
        accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      } catch {}
    }
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }

  // 验证 token 并检查邮箱白名单
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(accessToken)

  if (error || !user) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }

  if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.redirect(new URL('/admin-login?error=forbidden', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
