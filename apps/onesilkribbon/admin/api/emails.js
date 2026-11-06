// /api/admin/emails?search=&kind=&status=&page= —— 邮件发送记录（email_log 表）
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { cleanSearch } from './_helpers'

const PAGE_SIZE = 50

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  // 搜索词会拼进 .or() 过滤串，先去掉逗号括号这些会破坏语法的字符
  const search = cleanSearch(searchParams.get('search'))
  const kind = searchParams.get('kind') || ''
  const status = searchParams.get('status') || ''
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)

  let query = supabaseAdmin.from('email_log').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id')
  if (search) query = query.or(`to_email.ilike.%${search}%,subject.ilike.%${search}%,order_number.ilike.%${search}%`)
  if (kind) query = query.eq('kind', kind)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (error) return errorResponse(error, { tag: 'admin-emails-get' })
  return Response.json({ emails: data || [], total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)) })
}
