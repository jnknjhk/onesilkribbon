import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // 只保护 /admin 路由
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  // 创建响应对象（SSR 客户端需要能写 cookie）
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 获取当前登录用户
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }

  if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.redirect(new URL('/admin-login?error=forbidden', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
