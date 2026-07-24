import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// 普通客户端（用于非 auth 场景，如查询商品等）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// service-role 客户端——绕过所有 RLS 策略。这是有意为之的架构选择：前台的 Server
// Component（首页/系列页/商品页/文章页等）和后台管理接口都统一用它查库，包括查询
// products/site_images/journal_posts 这类本来公开可读的数据，靠应用层手写
// .eq('is_active', true) / .eq('is_published', true) 过滤，而不依赖 RLS 兜底。
// 这意味着任何新增的查询都必须自己记得加对应的过滤条件——RLS 在这些路径上不会替你把关。
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

// SSR 浏览器客户端（用于登录/登出，session 存入 cookie）
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
