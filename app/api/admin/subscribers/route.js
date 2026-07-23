import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

// GET /api/admin/subscribers — 订阅者列表，支持按邮箱搜索、按来源筛选
// ?search=&source=&all=1（all=1 时不分页，供导出 CSV 用）
export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim().toLowerCase()
  const source = searchParams.get('source') || ''
  const all = searchParams.get('all') === '1'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = 30

  let query = supabaseAdmin
    .from('subscribers')
    .select('id, email, source, status, verified, subscribed_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (search) query = query.ilike('email', `%${search}%`)
  if (source) query = query.eq('source', source)
  if (!all) query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    subscribers: data || [],
    total: count || 0,
    totalPages: all ? 1 : Math.max(1, Math.ceil((count || 0) / pageSize)),
  })
}
