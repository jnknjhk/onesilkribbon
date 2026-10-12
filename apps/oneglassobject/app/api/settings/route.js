import { supabaseAdmin } from '@osr/core/lib/supabase'
import { NextResponse } from 'next/server'
import { errorResponse } from '@osr/core/lib/api-error'

// 前台读运费设置用，公开。写入在 /api/admin/settings——管理员接口必须放在
// /api/admin 下面，才有中间件那一层 401 兜底。
//
// 必须声明成动态：Next 14 会把只有 GET 的 route handler 在构建时静态化，
// 后台改了运费前台却一直读到构建那一刻的值，直到下次部署。
// （以前同一个文件里还有 POST，顺带让整个路由变成了动态，所以没暴露出来。）
export const dynamic = 'force-dynamic'
// 光有 force-dynamic 还不够：Next 14 里只有 GET 的路由，里面的 fetch（supabase-js 底层就是 fetch）
// 默认会进 Data Cache 并且永不过期，还会和其它页面里一模一样的查询共用缓存——
// 结果后台改了运费，购物车里显示的还是旧运费，而结账按新运费收钱。这里强制每次都查库。
export const fetchCache = 'force-no-store'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
  if (error) return errorResponse(error, { tag: 'settings-get' })
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return NextResponse.json(map)
}
