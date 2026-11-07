// /api/admin/audit-log —— 后台敏感操作记录（只读）
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { isMissingRelation } from './_helpers'

const PAGE_SIZE = 50

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const { data, error, count } = await supabaseAdmin
    .from('admin_audit_log')
    .select('id, actor_email, action, target_type, target_id, detail, created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) {
    if (isMissingRelation(error)) {
      return Response.json({ entries: [], total: 0, page, totalPages: 1, unavailable: true })
    }
    return errorResponse(error, { tag: 'admin-audit-log' })
  }

  const total = count || 0
  return Response.json({
    entries: data || [], total, page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    unavailable: false,
  })
}
