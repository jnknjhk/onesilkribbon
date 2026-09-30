import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
import { deductStock, incrementCouponUses } from '@/lib/stock-check'
import { saveCheckoutDetailsToAccount } from '@/lib/user-records'
import { redirect } from 'next/navigation'

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getPayPalToken() {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

// 走完整个收款流程，返回 { success, reason }。
// 全部用提前 return 而不是层层嵌套——这里每一步都是"不满足条件就别再往下做"的校验，
// 嵌套写法会让几个安全检查藏在缩进深处，很容易漏看。
async function processCapture({ token, orderNumber }) {
  const accessToken = await getPayPalToken()

  const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  })
  const data = await capture.json()

  if (data.status !== 'COMPLETED') {
    console.error('PayPal capture did not complete for order', orderNumber, data)
    Sentry.captureMessage('PayPal capture not completed', {
      level: 'warning',
      tags: { api: 'paypal-capture', orderNumber },
      extra: { data },
    })
    return { success: false, reason: 'not_completed' }
  }

  const { data: session } = await supabaseAdmin
    .from('paypal_sessions')
    .select('*')
    .eq('order_number', orderNumber)
    .single()

  if (!session) {
    // 钱已经到账，但找不到对应的下单 session——绝不能悄悄告诉用户"成功"，
    // 必须留下痕迹以便人工核对（钱可能已经收了但订单没落库）。
    // 注意：重复访问同一条 capture 链接也会走到这里（session 在首次成功后就删掉了），
    // 所以下面先查一下订单是否已经建好，真·重复请求就直接认成功。
    const { data: existing } = await supabaseAdmin
      .from('orders').select('order_number').eq('order_number', orderNumber).maybeSingle()
    if (existing) return { success: true }

    console.error('PayPal capture succeeded but session missing for order', orderNumber)
    Sentry.captureMessage('PayPal captured but session missing — needs manual reconciliation', {
      level: 'error',
      tags: { api: 'paypal-capture', orderNumber },
      extra: { captureId: data.id },
    })
    return { success: false, reason: 'session_missing' }
  }

  // URL 里的 token（PayPal 那笔交易）和 order（我们的订单号）是两个独立参数，
  // 之前只按 order 查 session，从不核对两者是否属于同一笔交易。于是：
  // 先下一单贵的只创建不付款，再下一单便宜的正常付掉，然后手动访问
  // capture?token=<便宜单的 token>&order=<贵单的订单号>，系统就会按贵单的商品和金额
  // 建一张"已付款"订单、扣库存、发确认邮件——而实际只收到了便宜单的钱。
  // 所以先确认这个 token 就是当初为这个订单号创建的那个 PayPal 订单。
  if (session.paypal_order_id !== token) {
    console.error('PayPal token 与订单号不匹配', { orderNumber, token, expected: session.paypal_order_id })
    Sentry.captureMessage('PayPal token 与订单号不匹配，疑似篡改支付关联', {
      level: 'error',
      tags: { api: 'paypal-capture', orderNumber },
      extra: { token, expectedPaypalOrderId: session.paypal_order_id, captureId: data.id },
    })
    return { success: false, reason: 'token_mismatch' }
  }

  const items  = JSON.parse(session.items)
  const form   = JSON.parse(session.form)
  const totals = JSON.parse(session.totals)
  const userId = session.user_id || null

  const itemsTotal     = parseFloat(totals.subtotal || 0)
  const shippingAmount = parseFloat(totals.shipping || 0)
  const discountAmount = parseFloat(totals.discount || 0)
  const grandTotal     = parseFloat(totals.total    || 0)

  // 再核对实收金额。token 比对已经挡住了"拿别人的支付冒领订单"，这里兜第二层：
  // 万一 PayPal 那边的金额被改过（或我们建单时算错），也绝不能按订单原价发货。
  const captured         = data.purchase_units?.[0]?.payments?.captures?.[0]?.amount
  const capturedValue    = parseFloat(captured?.value ?? 'NaN')
  const capturedCurrency = captured?.currency_code

  if (!captured || Number.isNaN(capturedValue)) {
    // 状态是 COMPLETED 却读不到金额，说明返回结构和预期不符，不能想当然放过
    Sentry.captureMessage('PayPal capture 成功但读不到收款金额，需人工核对', {
      level: 'error',
      tags: { api: 'paypal-capture', orderNumber },
      extra: { captureId: data.id, purchaseUnits: data.purchase_units },
    })
    return { success: false, reason: 'amount_unreadable' }
  }

  if (Math.abs(capturedValue - grandTotal) > 0.01 || capturedCurrency !== 'GBP') {
    console.error('PayPal 收款金额与订单金额不符', { orderNumber, capturedValue, grandTotal })
    Sentry.captureMessage('PayPal 收款金额与订单金额不符，已拒绝建单', {
      level: 'error',
      tags: { api: 'paypal-capture', orderNumber },
      extra: { captureId: data.id, capturedValue, capturedCurrency, expected: grandTotal },
    })
    return { success: false, reason: 'amount_mismatch' }
  }

  const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert({
    order_number:      orderNumber,
    customer_email:    form.email,
    user_id:           userId,
    status:            'paid',
    paid_at:           new Date().toISOString(),
    subtotal_gbp:      itemsTotal.toFixed(2),
    vat_amount_gbp:    '0.00',
    shipping_gbp:      shippingAmount.toFixed(2),
    discount_gbp:      discountAmount.toFixed(2),
    total_gbp:         grandTotal.toFixed(2),
    shipping_name:     `${form.firstName} ${form.lastName}`,
    shipping_line1:    form.line1,
    shipping_line2:    form.line2 || null,
    shipping_city:     form.city,
    shipping_postcode: form.postcode || '',
    shipping_country:  form.country,
    phone:             form.phone ? `${form.dialCode || ''} ${form.phone}`.trim() : null,
    payment_method:    'paypal',
    payment_intent_id: data.id,
  }).select().single()

  // order_number 上有唯一约束，所以并发的重复请求会撞 23505 而不是建出第二张订单。
  // 这是正常的幂等结果，不是故障，不该报警。
  if (orderError?.code === '23505') {
    console.error('PayPal capture 重复请求，订单已存在:', orderNumber)
    return { success: true }
  }

  if (orderError || !order) {
    // 钱已经到账但订单写库失败——需要人工介入，不能对用户显示成功
    console.error('PayPal order insert failed for', orderNumber, orderError)
    Sentry.captureMessage('PayPal captured but order insert failed — needs manual reconciliation', {
      level: 'error',
      tags: { api: 'paypal-capture', orderNumber },
      extra: { captureId: data.id, orderError },
    })
    return { success: false, reason: 'order_save_failed' }
  }

  if (items.length > 0) {
    // 钱已经收了，这里再失败就是"有订单但不知道客户买了什么"——发不了货，
    // 事后也无从补救，所以必须报警而不是静默跳过
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
      items.map(i => ({
        order_id:        order.id,
        product_id:      i.productId || null,
        sku_id:          i.skuId || null,
        product_name:    i.name,
        sku_description: i.skuDesc || '',
        quantity:        i.qty,
        unit_price_gbp:  parseFloat(i.price).toFixed(2),
        line_total_gbp:  (parseFloat(i.price) * i.qty).toFixed(2),
      }))
    )
    if (itemsError) {
      Sentry.captureMessage('PayPal 已收款但订单明细写入失败，该订单无法发货', {
        level: 'error',
        tags: { api: 'paypal-capture', orderNumber },
        extra: { itemsError: itemsError.message, items },
      })
    }

    await deductStock(items)
  }

  // 登录用户：把收货信息补进账户
  await saveCheckoutDetailsToAccount({ userId, form })

  // 优惠码使用次数递增（单条 UPDATE，并发安全）
  await incrementCouponUses(totals.couponCode)

  // 删除临时 session
  await supabaseAdmin.from('paypal_sessions').delete().eq('order_number', orderNumber)

  const emailTotals = {
    subtotal:     itemsTotal.toFixed(2),
    shipping:     shippingAmount.toFixed(2),
    total:        grandTotal.toFixed(2),
    freeShipping: shippingAmount === 0,
  }

  try {
    await sendOrderConfirmation({ order, items, form, totals: emailTotals })
  } catch (e) {
    console.error('Order confirmation email error:', e.message)
  }

  try {
    await sendOwnerNotification({ order, items, form, totals: emailTotals })
  } catch (e) {
    console.error('Owner notification email error:', e.message)
  }

  return { success: true }
}

// 注意：next/navigation 的 redirect() 内部通过 throw 实现，绝不能写在 try 块里面，
// 否则会被 catch(err) 当成异常吞掉。所以这里只在 try/catch 之外做唯一一次 redirect，
// try/catch 内部只负责把结果落在 outcome 变量上。
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const token       = searchParams.get('token')
  const orderNumber = searchParams.get('order')

  if (!token || !orderNumber) {
    redirect(`/checkout?payment_error=missing_params`)
  }

  let outcome = { success: false, reason: 'unknown' }
  try {
    outcome = await processCapture({ token, orderNumber })
  } catch (err) {
    Sentry.captureException(err, { tags: { api: 'paypal-capture', orderNumber } })
    console.error('PayPal capture error:', err)
    outcome = { success: false, reason: 'exception' }
  }

  if (outcome.success) {
    redirect(`/order-confirmed?order=${orderNumber}`)
  }
  redirect(`/checkout?payment_error=${outcome.reason}&order=${orderNumber}`)
}
