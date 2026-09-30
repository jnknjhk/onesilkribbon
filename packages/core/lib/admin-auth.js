import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

// 中间件校验通过后，把管理员邮箱写在这个请求头里传给下游路由。
// 客户端传进来的同名头会被中间件无条件删除，所以这个头只可能来自中间件。
export const ADMIN_HEADER = 'x-osr-admin-email'

export function isAdminEmail(email) {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function verifyAdmin() {
  // 快路径：中间件在同一个请求里已经调过 supabase.auth.getUser() 验过身份了。
  // 再验一次就是又一个网络往返（线上约 450ms），而后台每个操作都要走一次接口，
  // 白等的时间很可观。中间件覆盖了全部 /admin 与 /api/admin 路径，且会先删掉
  // 外部传入的同名头，所以这里读到值就说明确实验过。
  try {
    const h = await headers()
    const forwarded = h.get(ADMIN_HEADER)
    if (forwarded && isAdminEmail(forwarded)) return { email: forwarded }
  } catch {
    // 拿不到请求头（比如在非请求上下文里调用）就走下面的完整校验
  }

  // 慢路径：没有中间件转发的身份时，自己完整校验一次。
  // 这条路径保证了即使中间件没跑到（配置变动、路径没被 matcher 覆盖），鉴权依然成立。
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  if (!isAdminEmail(user.email)) return null
  return user
}
