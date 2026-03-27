import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 服务端客户端（带 Auth cookie，用于 Server Components / Route Handlers）
export function createServerClient() {
  const cookieStore = cookies()
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
      auth: {
        persistSession: false,
      },
    }
  )
}

// 从请求中解析当前登录用户（用于 Route Handlers）
export async function getSessionUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const cookieHeader = request.headers.get('cookie') || ''

  // 优先从 Authorization Bearer token 获取
  let accessToken = null
  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7)
  }

  // 否则从 cookie 中提取 Supabase session token
  if (!accessToken && cookieHeader) {
    const match = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/)
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1])
        const parsed = JSON.parse(decoded)
        accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      } catch {}
    }
  }

  if (!accessToken) return null

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: { user }, error } = await client.auth.getUser(accessToken)
  if (error || !user) return null
  return user
}
