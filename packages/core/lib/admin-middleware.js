import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { isAdminEmail, ADMIN_HEADER } from './admin-auth'

// 各站点 middleware.js 共用的后台鉴权中间件。放在 core 里是因为两个站各抄一份时，
// 一边修了的安全问题另一边一直没跟上。
//
// 调用方的 matcher 必须覆盖全部路径（只排除 _next 静态资源），而不只是 /admin 与
// /api/admin：verifyAdmin() 的快路径信任 ADMIN_HEADER，这个头只有被中间件清掉之后
// 才可信。之前 matcher 只覆盖后台路径，/api/settings 和 /api/email 这两条不在后台
// 路径下、却调用了 verifyAdmin() 的路由，客户端自己带上这个头就能冒充管理员。
export async function adminMiddleware(request) {
  const { pathname } = request.nextUrl

  // 按路径段精确匹配，而不是 startsWith('/admin')——那样会把 /admin-login 也当成后台页，
  // 未登录时重定向到 /admin-login，又被拦下重定向，死循环
  const isAdminApi  = pathname === '/api/admin' || pathname.startsWith('/api/admin/')
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/')

  if (!isAdminApi && !isAdminPage) {
    // 非后台路径不做鉴权（不发任何网络请求），只负责清掉伪造的身份头
    if (!request.headers.has(ADMIN_HEADER)) return NextResponse.next()
    const stripped = new Headers(request.headers)
    stripped.delete(ADMIN_HEADER)
    return NextResponse.next({ request: { headers: stripped } })
  }

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
