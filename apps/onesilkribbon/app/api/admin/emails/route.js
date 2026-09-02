import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { errorResponse } from '@osr/core/lib/api-error'

const PAGE_SIZE = 50

// GET /api/admin/emails?search=&kind=&status=&page=1
// 邮件发送记录，支持按收件人/主题/订单号搜索，按类型和状态筛选
export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const kind   = searchParams.get('kind') || ''
  const status = searchParams.get('status') || ''
  const page   = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)

  let query = supabaseAdmin
    .from('email_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (search) query = query.or(`to_email.ilike.%${search}%,subject.ilike.%${search}%,order_number.ilike.%${search}%`)
  if (kind)   query = query.eq('kind', kind)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    // 迁移脚本还没执行时表不存在——给出可操作的提示，而不是一个看不懂的数据库错误
    if (/does not exist|schema cache/i.test(error.message)) {
      return Response.json({
        emails: [], total: 0, totalPages: 1,
        notReady: '邮件记录表尚未创建。请在 Supabase 后台执行 supabase/migrations/2026-09-02-email-log.sql',
      })
    }
    return errorResponse(error, { tag: 'admin-emails-get' })
  }

  return Response.json({
    emails: data || [],
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
  })
}
