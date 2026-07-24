import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export async function middleware(request) {
  const { pathname } = request.nextUrl

  const isAdminApi  = pathname.startsWith('/api/admin')
  const isAdminPage = pathname.startsWith('/admin')
  if (!isAdminApi && !isAdminPage) return NextResponse.next()

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
  const isAuthorized = !error && user && ADMIN_EMAILS.includes(user.email.toLowerCase())

  if (isAuthorized) return response

  // /api/admin/* 是接口，未授权时必须返回 401 JSON——重定向到登录页对 fetch() 调用方毫无意义，
  // 而且这是兜底防线：就算某个 admin API route 里忘了自己调 verifyAdmin()，这里也会先拦住
  if (isAdminApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reason = !error && user ? '?error=forbidden' : ''
  return NextResponse.redirect(new URL(`/admin-login${reason}`, request.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
}
