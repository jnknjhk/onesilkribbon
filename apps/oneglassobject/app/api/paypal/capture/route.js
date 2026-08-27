import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
import { deductStock } from '@/lib/stock-check'
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

// 注意：next/navigation 的 redirect() 内部通过 throw 实现，绝不能写在 try 块里面，
// 否则会被下面的 catch(err) 当成异常吞掉。所以这里只在 try/catch 之外做唯一一次 redirect，
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
      outcome = { success: false, reason: 'not_completed' }
    } else {
      const { data: session } = await supabaseAdmin
        .from('paypal_sessions')
        .select('*')
        .eq('order_number', orderNumber)
        .single()

      if (!session) {
        // 支付已经 Capture 成功，但找不到对应的下单 session——这种情况绝不能悄悄告诉用户"成功"，
        // 必须留下痕迹以便人工核对（钱可能已经到账但订单没有落库）。
        console.error('PayPal capture succeeded but session missing for order', orderNumber)
        Sentry.captureMessage('PayPal captured but session missing — needs manual reconciliation', {
          level: 'error',
          tags: { api: 'paypal-capture', orderNumber },
          extra: { captureId: data.id },
        })
        outcome = { success: false, reason: 'session_missing' }
      } else {
        const items  = JSON.parse(session.items)
        const form   = JSON.parse(session.form)
        const totals = JSON.parse(session.totals)
        const userId = session.user_id || null

        const itemsTotal     = parseFloat(totals.subtotal || 0)
        const shippingAmount = parseFloat(totals.shipping || 0)
        const discountAmount = parseFloat(totals.discount || 0)
        const grandTotal     = parseFloat(totals.total    || 0)

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

        if (orderError || !order) {
          // 钱已经 Capture 成功，但订单写库失败——同样需要人工介入，不能对用户显示成功。
          console.error('PayPal order insert failed for', orderNumber, orderError)
          Sentry.captureMessage('PayPal captured but order insert failed — needs manual reconciliation', {
            level: 'error',
            tags: { api: 'paypal-capture', orderNumber },
            extra: { captureId: data.id, orderError },
          })
          outcome = { success: false, reason: 'order_save_failed' }
        } else {
          // 写入订单商品（包含 sku_id 和 product_id）
          if (items.length > 0) {
            await supabaseAdmin.from('order_items').insert(
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

            // 扣减库存
            await deductStock(items)
          }

          // 优惠码使用次数递增
          const couponCode = totals.couponCode
          if (couponCode) {
            const { data: cp } = await supabaseAdmin.from('coupons').select('uses_count').eq('code', couponCode).single()
            if (cp) {
              await supabaseAdmin.from('coupons').update({ uses_count: (cp.uses_count || 0) + 1 }).eq('code', couponCode)
            }
          }

          // 删除临时 session
          await supabaseAdmin.from('paypal_sessions').delete().eq('order_number', orderNumber)

          const emailTotals = {
            subtotal:    itemsTotal.toFixed(2),
            shipping:    shippingAmount.toFixed(2),
            total:       grandTotal.toFixed(2),
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

          outcome = { success: true }
        }
      }
    }
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
