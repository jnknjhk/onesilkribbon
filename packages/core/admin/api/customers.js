// /api/admin/customers —— 两个站共用
//   GET            客户列表（按邮箱聚合）
//   GET ?email=x   单个客户：全部订单、收货地址、账户资料、是否订阅
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const email = new URL(req.url).searchParams.get('email')
    return email ? customerDetail(email) : customerList()
  } catch (err) {
    return errorResponse(err, { tag: 'admin-customers-get' })
  }
}

async function customerList() {
  const [{ data: profiles }, summary] = await Promise.all([
    fetchAll(() => supabaseAdmin.from('user_profiles')
      .select('id, email, first_name, last_name, avatar_url, created_at').order('id')),
    // 首选数据库里的 customer_summary 视图：整表参与聚合。分页取完，不受 1000 行上限影响
    fetchAll(() => supabaseAdmin.from('customer_summary').select('*').order('email')),
  ])
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  if (!summary.error) {
    const customers = summary.data.map(r => ({
      email:     r.email,
      name:      r.name,
      city:      r.city,
      country:   r.country,
      orders:    r.orders,
      spent:     Number(r.spent || 0),
      lastOrder: r.last_order,
      user_id:   r.user_id || null,
      profile:   r.user_id ? profileMap[r.user_id] || null : null,
    }))
    customers.sort((a, b) => b.spent - a.spent)
    return Response.json({ customers })
  }

  // 视图还没建（玻璃站、或迁移没跑）时，在这里按邮箱聚合全部订单。
  // 订单也是分页取完的，所以数字是准的——以前这条退路只看最近 5000 单，老客户会算少
  if (!/does not exist|schema cache|relation/i.test(summary.error.message || '')) {
    return errorResponse(summary.error, { tag: 'admin-customers-view' })
  }
  const { data: orders, error } = await fetchAll(() => supabaseAdmin.from('orders')
    .select('customer_email, shipping_name, shipping_city, shipping_country, total_gbp, created_at, user_id')
    .order('created_at', { ascending: false }).order('id', { ascending: false }))
  if (error) return errorResponse(error, { tag: 'admin-customers-orders' })

  const map = {}
  for (const o of orders) {
    const key = o.customer_email || 'unknown'
    const c = map[key] ||= {
      email: key, name: o.shipping_name, city: o.shipping_city, country: o.shipping_country,
      orders: 0, spent: 0, lastOrder: o.created_at, user_id: null, profile: null,
    }
    c.orders++
    c.spent += parseFloat(o.total_gbp || 0)
    if (o.created_at > c.lastOrder) c.lastOrder = o.created_at
    if (o.user_id && !c.user_id) { c.user_id = o.user_id; c.profile = profileMap[o.user_id] || null }
  }
  const customers = Object.values(map).map(c => ({ ...c, spent: Math.round(c.spent * 100) / 100 }))
  customers.sort((a, b) => b.spent - a.spent)
  return Response.json({ customers })
}

async function customerDetail(email) {
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
