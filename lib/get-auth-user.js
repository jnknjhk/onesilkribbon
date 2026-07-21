import { supabaseAdmin } from '@/lib/supabase'

// 从请求里解析出真正登录的用户，不信任客户端传来的 userId 字段。
// 支持 Authorization: Bearer <token>（前端主动传）或 sb-access-token cookie（session 场景）。
export async function getAuthUser(req) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) return user
  }

  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
  if (match) {
    const token = decodeURIComponent(match[1])
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) return user
  }

  return null
}
