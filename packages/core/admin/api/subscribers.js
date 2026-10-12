// /api/admin/subscribers —— 两个站共用
//   GET ?search=&source=&page=   订阅者列表（30 条一页）
//   GET ...&all=1                全部符合条件的订阅者（导出 CSV 用）。分页取完，
//                                以前一次查询最多只能拿到 1000 条，导出会悄悄少人
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'

const PAGE_SIZE = 30

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const source = searchParams.get('source') || ''
    const all = searchParams.get('all') === '1'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

    const base = (opts) => {
      let q = supabaseAdmin.from('subscribers')
        .select('id, email, source, status, verified, subscribed_at, created_at', opts)
        .order('created_at', { ascending: false }).order('id')
      if (search) q = q.ilike('email', `%${search}%`)
      if (source) q = q.eq('source', source)
      return q
    }

    if (all) {
      const { data, error } = await fetchAll(() => base())
      if (error) return errorResponse(error, { tag: 'admin-subscribers-all' })
      return Response.json({ subscribers: data, total: data.length, totalPages: 1 })
    }

    const { data, error, count } = await base({ count: 'exact' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (error) return errorResponse(error, { tag: 'admin-subscribers-get' })
    return Response.json({
      subscribers: data || [],
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
    })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-subscribers-get' })
  }
}
