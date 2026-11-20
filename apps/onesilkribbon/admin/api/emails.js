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
  const deliveryId = searchParams.get('deliveryId')
  if (deliveryId !== null) return readDeliveryStatus(deliveryId)
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

async function readDeliveryStatus(id) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const reply = (body, status = 200) => Response.json(body, { status, headers })
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) {
    return reply({ error: '邮件记录 ID 无效' }, 400)
  }

  try {
    const { data, error } = await supabaseAdmin.from('email_log')
      .select('provider_id').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data?.provider_id) return reply({ error: '此邮件没有可查询的投递记录' }, 404)
    const key = process.env.RESEND_API_KEY
    if (!key) return reply({ error: '邮件服务暂不可用' }, 503)

    const response = await fetch('https://api.resend.com/emails/' + encodeURIComponent(data.provider_id), {
      headers: { Authorization: 'Bearer ' + key },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 404) return reply({ error: '发信服务已找不到这封邮件的记录' }, 404)
    if (!response.ok) return reply({ error: '暂时无法查询投递状态，请稍后重试' }, 503)
    const { last_event: event } = await response.json()
    return reply({ event: typeof event === 'string' ? event : null })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-email-delivery', message: '暂时无法查询投递状态，请稍后重试' })
  }
}
