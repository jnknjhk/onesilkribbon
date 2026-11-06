// /api/admin/customers
//   GET                        客户列表（按邮箱聚合）
//   GET ?email=x               单个客户：全部订单、收货地址、账户资料、是否订阅
//   GET ?email=x&erase=preview 删除这位客户会动到哪些数据（确认框里展示）
//   DELETE { email }           删除客户（做法见 customer-erase.js）
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { cleanSearch, pageRange } from './_helpers'
import { planErasure, eraseCustomer } from './customer-erase'
import { ERASED_EMAIL } from '../lib/erasure'

const notErasable = email => !email || email === ERASED_EMAIL || email === 'unknown'

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = new URL(req.url).searchParams
    const email = params.get('email')
    if (email && params.get('erase') === 'preview') {
      if (notErasable(email)) return Response.json({ error: '这位客户不能删除' }, { status: 400 })
      const plan = await planErasure(email)
      return Response.json({ summary: plan.summary, blockers: plan.blockers })
    }
    return email ? await customerDetail(email) : await customerList(params)
  } catch (err) {
    return errorResponse(err, { tag: 'admin-customers-get' })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email } = await req.json()
    if (notErasable(email)) return Response.json({ error: '这位客户不能删除' }, { status: 400 })
    const result = await eraseCustomer(email)
    if (!result.ok) return Response.json({ error: result.blockers.join(' '), blockers: result.blockers }, { status: 409 })
    console.log('[admin-customers] 已删除客户', { by: admin.email, ...result.done })
    return Response.json(result)
  } catch (err) {
    return errorResponse(err, { tag: 'admin-customers-delete', message: '删除没有全部完成，请再点一次删除（已经处理过的部分不会重复处理）' })
  }
}

async function customerList(params) {
  const q = cleanSearch(params.get('q'))
  const type = params.get('type') || 'all'

  // 同一个视图查询，只换类型条件；数据页和页签计数共用这套过滤
  const queryFor = (typeFilter, select = '*', options = {}) => {
    let query = supabaseAdmin.from('customer_summary').select(select, options).neq('email', ERASED_EMAIL)
    if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`)
    if (typeFilter === 'registered') query = query.not('user_id', 'is', null)
    if (typeFilter === 'guest') query = query.is('user_id', null)
    return query
  }

  // 发邮件页的收件人候选：不参与分页，只取前 500 个邮箱和姓名
  if (params.get('all') === '1') {
    const { data, error } = await queryFor('all', 'email, name').order('email').limit(500)
    if (error) return errorResponse(error, { tag: 'admin-customers-all' })
    return Response.json({ customers: data || [] })
  }

  const { page, pageSize, from, to } = pageRange(params)
  const [listRes, allCountRes, registeredCountRes] = await Promise.all([
    queryFor(type, '*', { count: 'exact' })
      .order('spent', { ascending: false }).order('email').range(from, to),
    queryFor('all', 'email', { count: 'exact', head: true }),
    queryFor('registered', 'email', { count: 'exact', head: true }),
  ])
  if (listRes.error) return errorResponse(listRes.error, { tag: 'admin-customers-list' })
  if (allCountRes.error) return errorResponse(allCountRes.error, { tag: 'admin-customers-count' })
  if (registeredCountRes.error) return errorResponse(registeredCountRes.error, { tag: 'admin-customers-count' })

  const total = listRes.count || 0
  const all = allCountRes.count || 0
  const registered = registeredCountRes.count || 0
  return Response.json({
    customers: (listRes.data || []).map(r => ({
      email:     r.email,
      name:      r.name,
      city:      r.city,
      country:   r.country,
      orders:    r.orders,
      spent:     Number(r.spent || 0),
      lastOrder: r.last_order,
      user_id:   r.user_id || null,
    })),
    total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: { all, registered, guest: Math.max(0, all - registered) },
  })
}

async function customerDetail(email) {
  if (email === ERASED_EMAIL) return Response.json({ error: '这位客户已经删除，个人信息已抹去' }, { status: 404 })
  const { data: orders, error } = await supabaseAdmin.from('orders')
    .select('id, order_number, status, total_gbp, created_at, paid_at, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_postcode, shipping_country, phone, user_id')
    .eq('customer_email', email)
    .order('created_at', { ascending: false })
  if (error) return errorResponse(error, { tag: 'admin-customer-orders' })

  const userId = (orders || []).find(o => o.user_id)?.user_id || null
  const [profileRes, addressesRes, subscriberRes] = await Promise.all([
    userId ? supabaseAdmin.from('user_profiles').select('*').eq('id', userId).maybeSingle() : { data: null },
    userId ? supabaseAdmin.from('user_addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }) : { data: [] },
    // 订阅时邮箱统一存成小写（见 /api/subscribe）
    supabaseAdmin.from('subscribers').select('email, status, verified, source, subscribed_at, created_at').eq('email', email.trim().toLowerCase()).maybeSingle(),
  ])

  const latest = (orders || [])[0]
  const spent = (orders || []).reduce((n, o) => n + (['paid', 'shipped', 'delivered'].includes(o.status) ? parseFloat(o.total_gbp) || 0 : 0), 0)
  return Response.json({
    customer: {
      email,
      name: latest?.shipping_name || [profileRes.data?.first_name, profileRes.data?.last_name].filter(Boolean).join(' ') || '',
      phone: profileRes.data?.phone || latest?.phone || '',
      user_id: userId,
      orders: (orders || []).length,
      spent: Math.round(spent * 100) / 100,
      firstOrder: (orders || []).at(-1)?.created_at || null,
      lastOrder: latest?.created_at || null,
    },
    orders: orders || [],
    profile: profileRes.data || null,
    addresses: addressesRes.data || [],
    // 订单上的收货地址也列出来（访客没有账户地址，只能从订单里看）
    shippingAddresses: dedupeAddresses(orders || []),
    subscriber: subscriberRes.error ? null : (subscriberRes.data || null),
  })
}

function dedupeAddresses(orders) {
  const seen = new Set()
  const out = []
  for (const o of orders) {
    const line = [o.shipping_line1, o.shipping_line2, o.shipping_city, o.shipping_postcode, o.shipping_country].filter(Boolean).join(', ')
    if (!line || seen.has(line)) continue
    seen.add(line)
    out.push({ name: o.shipping_name, line, last_used: o.created_at })
  }
  return out
}
