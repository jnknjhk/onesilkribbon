import { supabaseAdmin } from '@osr/core/lib/supabase'
import { NextResponse } from 'next/server'
import { errorResponse } from '@osr/core/lib/api-error'

// 前台读运费设置用，公开。写入在 /api/admin/settings——管理员接口必须放在
// /api/admin 下面，才有中间件那一层 401 兜底。
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
  if (error) return errorResponse(error, { tag: 'settings-get' })
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return NextResponse.json(map)
}
