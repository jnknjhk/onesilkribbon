import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// 这个模块只能被服务端代码导入。浏览器端请使用 ./supabase-browser。
// 缺少 service key 时直接失败，绝不回退到 anon key：否则后台写操作会以匿名身份执行，
// 表现为“RLS 拒绝/数据没写进去”，而不是启动时明确报错。
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for server-side data access')
}

// service-role 客户端——绕过所有 RLS 策略。这是有意为之的架构选择：前台的 Server
// Component（首页/系列页/商品页/文章页等）和后台管理接口都统一用它查库，包括查询
// products/site_images/journal_posts 这类本来公开可读的数据，靠应用层手写
// .eq('is_active', true) / .eq('is_published', true) 过滤，而不依赖 RLS 兜底。
// 这意味着任何新增的查询都必须自己记得加对应的过滤条件——RLS 在这些路径上不会替你把关。
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
