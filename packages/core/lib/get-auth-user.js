import { supabaseAdmin } from './supabase'
import { createServerClient } from '@supabase/ssr'

// 从请求里解析出真正登录的用户，不信任客户端传来的 userId 字段。
// 支持 Authorization: Bearer <token>（前端主动传）或 @supabase/ssr 写入的 sb-<project-ref>-auth-token cookie（session 场景）。
export async function getAuthUser(req) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    return !error && user ? user : null
  }

  // Let the same SDK that writes the session read it: SSR cookies can be
  // base64 encoded and split across .0/.1/... chunks, not just raw JSON.
  const cookieClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: {
      getAll() {
        if (req.cookies?.getAll) return req.cookies.getAll()
        return (req.headers.get('cookie') || '').split(';').flatMap(part => {
          const separator = part.indexOf('=')
          if (separator < 1) return []
          const name = part.slice(0, separator).trim()
          const raw = part.slice(separator + 1).trim()
          try { return [{ name, value: decodeURIComponent(raw) }] }
          catch { return [] }
        })
      },
      // These APIs only identify a user; browser auth handles session refresh.
      setAll() {},
    } }
  )
  const { data: { user }, error } = await cookieClient.auth.getUser()
  return !error && user ? user : null
}
