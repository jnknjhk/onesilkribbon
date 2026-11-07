// /api/admin/dashboard —— 工作台数据
// 统计下推到数据库函数，后台不再把所有订单/SKU/明细拉到 Node 内存。
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabaseAdmin.rpc('admin_dashboard')
    if (error) return errorResponse(error, { tag: 'admin-dashboard' })
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return errorResponse(new Error('Invalid dashboard response'), { tag: 'admin-dashboard' })
    }
    return Response.json(data)
  } catch (err) {
    return errorResponse(err, { tag: 'admin-dashboard' })
  }
}
