import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { isAdminEmail, ADMIN_HEADER } from '@osr/core/lib/admin-auth'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  const isAdminApi  = pathname.startsWith('/api/admin')
  const isAdminPage = pathname.startsWith('/admin')
  if (!isAdminApi && !isAdminPage) return NextResponse.next()

  // Supabase 在校验过程中可能刷新会话并要求写回 cookie。这里先收集起来，
  // 等确定要返回哪一个 response（放行 / 401 / 跳登录）之后再统一写上去——
  // 否则中途换 response 对象会把刷新后的 cookie 丢掉，用户会莫名其妙掉登录。
  let pendingCookies = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          pendingCookies = cookiesToSet
        },
      },
    }
  )

  // 获取当前登录用户（一次网络请求）
  const { data: { user }, error } = await supabase.auth.getUser()
  const isAuthorized = !error && user && isAdminEmail(user.email)

  // 把验过的身份通过请求头传给下游的 route handler，让 verifyAdmin() 不必为同一个请求
  // 再向 Supabase 要一次 getUser()。原来每次后台请求要做两次网络鉴权（这里一次、
  // 路由里一次），线上一个往返约 450ms，等于每次点击都白等近一秒。
  //
  // 防伪造：先把外部可能带进来的同名头**删掉**，只有校验通过后才由中间件自己写入。
  // 客户端无论怎么伪造这个头都会在这一步被清掉，而且中间件对所有 /admin 与
  // /api/admin 路径都会运行（见下方 matcher），绕不过去。
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.delete(ADMIN_HEADER)
  if (isAuthorized) forwardedHeaders.set(ADMIN_HEADER, user.email)

  const response = isAuthorized
    ? NextResponse.next({ request: { headers: forwardedHeaders } })
    // /api/admin/* 是接口，未授权时必须返回 401 JSON——重定向到登录页对 fetch() 调用方
    // 毫无意义，而且这是兜底防线：就算某个 admin API route 里忘了自己调 verifyAdmin()，
    // 这里也会先拦住
    : isAdminApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL(`/admin-login${!error && user ? '?error=forbidden' : ''}`, request.url))

  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
}
