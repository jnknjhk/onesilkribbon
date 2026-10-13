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

  // 后台页面本身是不含任何数据的空壳（数据全部从 /api/admin/* 取，接口每次都严格校验）。
  // 所以页面请求（打开页面、切换页面、链接预取）只看本地 cookie 里的会话来决定显示后台还是
  // 跳去登录，不向 Supabase 发请求——每次切换页面省掉一个往返（线上几百毫秒）。
  // 这条路上**不写** ADMIN_HEADER：没经过 Supabase 验证的身份，只够决定"显示不显示外框"，
  // 不能让任何服务端代码当成已验证的管理员。
  // 会话快过期 / 已过期时走下面完整的校验（顺带刷新登录状态）。
  if (isAdminPage) {
    const claims = await localSessionClaims(supabase)
    if (claims && isAdminEmail(claims.email) && claims.exp * 1000 - Date.now() > 60_000) {
      const headers = new Headers(request.headers)
      headers.delete(ADMIN_HEADER)
      const response = NextResponse.next({ request: { headers } })
      pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      return response
    }
  }

  // 校验登录：getClaims() 先看 token 的签名方式——
  //   · Supabase 项目用的是新的非对称签名密钥（ES256/RS256）时，在这里本地验签名和有效期，
  //     不发网络请求（公钥每 10 分钟取一次，缓存在内存里）
  //   · 还是旧的 HS256 密钥时，它自己退回 getUser()，问一次 Supabase，和以前完全一样
  // 本地验签的代价：已经退出登录的 token 在过期前（默认 1 小时）仍然有效。所以退款、删除客户、
  // 清理数据这几个不可撤销的操作，路由里会再用 verifyAdmin({ strict: true }) 问一次 Supabase。
  let email = null
  let signedIn = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    const c = !error && data?.claims
    if (c && c.role === 'authenticated' && !c.is_anonymous) { signedIn = true; email = c.email || null }
  } catch {
    // token 格式不对、签名算法不支持等会直接抛错：一律当作没登录（跳登录页 / 401），而不是 500
  }
  const isAuthorized = isAdminEmail(email)

  // 把验过的身份（签名有效、未过期的 token 里的邮箱）通过请求头传给下游的 route handler，
  // 让 verifyAdmin() 不必为同一个请求再校验一次。原来每次后台请求要做两次网络鉴权（这里一次、
  // 路由里一次），线上一个往返约 450ms，等于每次点击都白等近一秒。
  //
  // 防伪造：先把外部可能带进来的同名头**删掉**，只有校验通过后才由中间件自己写入。
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.delete(ADMIN_HEADER)
  if (isAuthorized) forwardedHeaders.set(ADMIN_HEADER, email)

  const response = isAuthorized
    ? NextResponse.next({ request: { headers: forwardedHeaders } })
    // /api/admin/* 是接口，未授权时必须返回 401 JSON——重定向到登录页对 fetch() 调用方
    // 毫无意义，而且这是兜底防线：就算某个 admin API route 里忘了自己调 verifyAdmin()，
    // 这里也会先拦住
    : isAdminApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL(`/admin-login${signedIn ? '?error=forbidden' : ''}`, request.url))

  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}

// 从 cookie 里的会话读出 access token 的内容（邮箱、过期时间），不发网络请求、不校验签名。
// 不用 session.user：服务端读它 Supabase 会打一条"可能不安全"的警告，而这里本来就只拿来做页面跳转判断
async function localSessionClaims(supabase) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return null
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(Array.from(atob(part), c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    const payload = JSON.parse(json)
    return typeof payload.exp === 'number' ? { email: payload.email, exp: payload.exp } : null
  } catch {
    return null
  }
}
