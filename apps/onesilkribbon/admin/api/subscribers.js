// /api/admin/subscribers
//   GET ?search=&source=&page=   订阅者列表（30 条一页）
//   GET ...&all=1                全部符合条件的订阅者（导出 CSV 用）。分页取完，
//                                以前一次查询最多只能拿到 1000 条，导出会悄悄少人
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { fetchAll } from './_helpers'
import { auditEmail, recordAdminAction } from '../lib/audit'
import { normalizeEmail } from '@/lib/unsubscribe'

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

// PATCH { id | email, unsubscribed: boolean }
// 后台手动标记退订/恢复订阅；退订同时清掉验证 token，之后重新订阅会重新走双重确认。
export async function PATCH(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : null
    const email = normalizeEmail(body?.email)
    const unsubscribed = body?.unsubscribed === true || body?.status === 'unsubscribed'
    if (!id && !email) return Response.json({ error: '缺少订阅者' }, { status: 400 })

    let query = supabaseAdmin.from('subscribers')
      .update(unsubscribed
        ? { status: 'unsubscribed', verified: false, verify_token: null, token_expires_at: null }
        : { status: 'active', verified: true })
      .select('id, email, status')
    query = id ? query.eq('id', id) : query.eq('email', email)
    const { data, error } = await query.limit(1)
    if (error) return errorResponse(error, { tag: 'admin-subscribers-patch' })
    if (!data?.length) return Response.json({ error: '找不到这位订阅者' }, { status: 404 })

    await recordAdminAction(admin, unsubscribed ? 'subscriber.unsubscribe' : 'subscriber.resubscribe', {
      targetType: 'subscriber',
      targetId: data[0].id,
      detail: { email: auditEmail(data[0].email) },
    })
    return Response.json({ subscriber: data[0] })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-subscribers-patch' })
  }
}
