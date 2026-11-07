// 删除客户 = 按 GDPR"删除个人数据"的做法处理，而不是把记录全删掉：
//   · 删除：登录账号、账户资料、常用地址、邮件订阅
//   · 关闭：没付过钱的待付款订单（释放库存预留，不删除订单/支付证据）
//   · 保留但抹掉个人信息：所有订单。金额、商品、日期、国家、付款单号都留着
//     （英国要求财务记录保留 6 年，销售统计也不能因此变少），姓名、邮箱、地址、电话清空
//   · 支付证据表只脱敏，不删除：保留金额、支付单号、时间用于对账
//
// 先 planErasure() 算出会动哪些数据（后台确认框里展示给你看），确认后 eraseCustomer() 执行。
// 每一步都可以重复执行：中途出错就再点一次删除，已经处理过的部分不会重复处理。
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { fetchAll } from './_helpers'
import { ERASED_EMAIL, ERASED_NAME } from '../lib/erasure'

const DAY = 86400000

// 订单上属于个人信息的字段。这里只改数据库里确实存在的列。
const PERSONAL = {
  customer_email:    ERASED_EMAIL,
  shipping_name:     ERASED_NAME,
  shipping_line1:    '—',
  shipping_line2:    null,
  shipping_city:     '—',
  shipping_postcode: '—',
  phone:             null,
  user_id:           null,
  customer_id:       null,
}

// 还没付过钱的订单：待付款的会先安全关闭；已取消的直接脱敏。
const isUnpaid = o => (o.status === 'pending' || o.status === 'cancelled') && !o.paid_at

async function findAccounts(email, orders) {
  const lower = email.trim().toLowerCase()
  const ids = new Set(orders.map(o => o.user_id).filter(Boolean))
  const { data: profiles, error } = await supabaseAdmin.from('user_profiles')
    .select('id, email').in('email', [...new Set([email, lower])])
  if (error) throw error
  for (const p of profiles || []) ids.add(p.id)

  const accounts = []   // 要删的：登录邮箱和这位客户一致
  const skipped = []    // 订单上记着、但登录邮箱是别人的账号：不碰
  for (const id of ids) {
    let authEmail = null
    let exists = false
    try {
      const { data, error: e } = await supabaseAdmin.auth.admin.getUserById(id)
      if (!e && data?.user) { exists = true; authEmail = data.user.email || null }
    } catch { /* id 不是合法的 uuid 等，当作账号不存在 */ }
    const profile = (profiles || []).find(p => p.id === id)
    if (exists) {
      if ((authEmail || '').toLowerCase() === lower) accounts.push({ id, auth: true })
      else skipped.push({ id, email: authEmail })
    } else if (profile && (profile.email || '').toLowerCase() === lower) {
      accounts.push({ id, auth: false }) // 登录账号已经没了，只剩资料
    }
  }
  return { accounts, skipped }
}

export async function planErasure(email) {
  const { data: orders, error } = await fetchAll(() => supabaseAdmin.from('orders').select('*')
    .eq('customer_email', email).order('id'))
  if (error) throw error

  const blockers = []
  const toShip = orders.filter(o => o.status === 'paid' || o.status === 'processing')
  if (toShip.length) {
    blockers.push(`还有 ${toShip.length} 笔已付款、还没发货的订单（${toShip.map(o => o.order_number).join('、')}）。删除后就没有收货地址了，请先发货或退款再删除。`)
  }
  const fresh = orders.filter(o => o.status === 'pending' && Date.now() - new Date(o.created_at).getTime() < DAY)
  if (fresh.length) {
    blockers.push(`有 ${fresh.length} 笔 24 小时内刚下、还没付款的订单，顾客可能正在付款，请过一天再删除。`)
  }

  // 已经有支付证据的待付款订单不能自动关闭；正在捕获的也不能动。
  const pendingNumbers = orders.filter(o => o.status === 'pending').map(o => o.order_number).filter(Boolean)
  if (pendingNumbers.length > 0) {
    const [receipts, holds] = await Promise.all([
      supabaseAdmin.from('payment_receipts').select('order_number').in('order_number', pendingNumbers),
      supabaseAdmin.from('checkout_reservations').select('order_number,state')
        .in('order_number', pendingNumbers).eq('state', 'capturing'),
    ])
    if (receipts.error) throw receipts.error
    if (holds.error) throw holds.error
    const paid = new Set((receipts.data || []).map(r => r.order_number))
    const capturing = new Set((holds.data || []).map(r => r.order_number))
    for (const number of pendingNumbers) {
      if (paid.has(number)) blockers.push(`订单 ${number} 已有支付证据，请先核对付款再删除。`)
      if (capturing.has(number)) blockers.push(`订单 ${number} 正在支付捕获中，请稍后再删除。`)
    }
  }

  const unpaid = orders.filter(isUnpaid)
  const pendingUnpaid = unpaid.filter(o => o.status === 'pending')
  const keep = orders.filter(o => !isUnpaid(o))
  const { accounts, skipped } = await findAccounts(email, orders)

  const lower = email.trim().toLowerCase()
  const sub = await supabaseAdmin.from('subscribers').select('id').eq('email', lower)
  if (sub.error) throw sub.error
  const addresses = accounts.length
    ? await supabaseAdmin.from('user_addresses').select('id', { count: 'exact', head: true }).in('user_id', accounts.map(a => a.id))
    : { count: 0 }
  if (addresses.error) throw addresses.error

  return {
    email,
    orders, unpaid, keep, accounts, skipped, blockers,
    summary: {
      closeOrders: pendingUnpaid.length,
      cancelledUnpaid: unpaid.length - pendingUnpaid.length,
      keepOrders: keep.length,
      accounts: accounts.length,
      addresses: addresses.count || 0,
      subscribed: (sub.data || []).length > 0,
      skippedAccounts: skipped.map(s => s.email),
    },
  }
}

export async function eraseCustomer(email) {
  const plan = await planErasure(email)
  if (plan.blockers.length) return { ok: false, blockers: plan.blockers }

  const lower = email.trim().toLowerCase()
  const done = { accounts: 0, closedOrders: 0, anonymizedOrders: 0, subscription: false }
  const must = (res, what) => { if (res.error) throw new Error(`${what}：${res.error.message}`); return res }

  // 1. 先安全关闭待付款订单。有任何一笔关闭不了，就在删除账号之前停下。
  const closeFailures = []
  for (const order of plan.unpaid.filter(o => o.status === 'pending')) {
    const { data, error } = await supabaseAdmin.rpc('close_unpaid_order', {
      p_order_number: order.order_number,
      p_reason: '客户删除：关闭未付款订单',
    })
    if (error) closeFailures.push(`${order.order_number}（${error.message}）`)
    else if (data?.changed) done.closedOrders++
  }
  if (closeFailures.length) {
    return {
      ok: false,
      blockers: [`以下订单无法安全关闭，请先核对支付状态：${closeFailures.join('、')}`],
    }
  }

  // 2. 在改动订单/客户记录之前，先把支付证据里的个人信息脱敏。
  //    只删 JSON 里的 PII 字段和原始 provider event，不删除任何记录/金额/支付单号。
  const orderNumbers = plan.orders.map(o => o.order_number).filter(Boolean)
  if (orderNumbers.length) {
    const { error: evidenceError } = await supabaseAdmin.rpc('anonymize_customer_payment_evidence', {
      p_order_numbers: orderNumbers,
    })
    if (evidenceError) throw new Error('支付证据脱敏失败：' + evidenceError.message)
  }

  // 3. 登录账号、资料、地址（先做：账号是靠订单上的 user_id 找到的，订单一抹就找不回了）
  for (const a of plan.accounts) {
    must(await supabaseAdmin.from('user_addresses').delete().eq('user_id', a.id), '删除地址失败')
    must(await supabaseAdmin.from('user_profiles').delete().eq('id', a.id), '删除账户资料失败')
    if (a.auth) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(a.id)
      if (error && !/not found/i.test(error.message || '')) throw new Error('删除登录账号失败：' + error.message)
    }
    done.accounts++
  }

  // 4. 邮件订阅（订阅时邮箱统一存小写）
  const sub = must(await supabaseAdmin.from('subscribers').delete().eq('email', lower).select('id'), '删除订阅失败')
  done.subscription = (sub.data || []).length > 0
  must(await supabaseAdmin.from('newsletter_subscribers').delete().in('email', [...new Set([email, lower])]), '删除旧订阅表失败')

  // 5. 所有订单保留，只换掉个人信息。付款过的订单是财务记录；未付款订单已经关闭，
  //    也保留下来供对账，不再物理删除。
  for (const o of plan.orders) {
    const patch = Object.fromEntries(Object.entries(PERSONAL).filter(([k]) => k in o))
    must(await supabaseAdmin.from('orders').update(patch).eq('id', o.id), '抹掉订单上的个人信息失败')
    done.anonymizedOrders++
  }

  // 6. 旧的 customers 表（订阅确认时写入）。订单上的 customer_id 已经在上一步清空。
  const cust = must(await supabaseAdmin.from('customers').select('id').in('email', [...new Set([email, lower])]), '读取客户表失败')
  const custIds = (cust.data || []).map(c => c.id)
  if (custIds.length) {
    must(await supabaseAdmin.from('orders').update({ customer_id: null }).in('customer_id', custIds), '解除订单关联失败')
    must(await supabaseAdmin.from('customers').delete().in('id', custIds), '删除客户表记录失败')
  }

  // 7. 欢迎优惠码的说明里写着邮箱（优惠码本身留着，可能还没用）
  for (const e of new Set([email, lower])) {
    must(await supabaseAdmin.from('coupons').update({ description: 'Welcome discount（客户已删除）' })
      .eq('description', `Welcome discount for ${e}`), '更新优惠码说明失败')
  }

  // 8. 邮件记录里的收件人（联系表单没有 order_number，单独按邮箱清理）
  must(await supabaseAdmin.from('email_log').update({ to_email: ERASED_EMAIL, subject: null, error: null })
    .in('to_email', [...new Set([email, lower])]), '更新邮件记录失败')

  return { ok: true, done, skippedAccounts: plan.summary.skippedAccounts }
}
