import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
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

async function deductStock(items) {
  for (const item of items) {
    if (!item.skuId) continue
    const { data: sku } = await supabaseAdmin
      .from('product_skus').select('stock_qty').eq('id', item.skuId).single()
    if (!sku) continue
    const newQty = Math.max(0, (sku.stock_qty || 0) - (item.qty || 1))
    await supabaseAdmin.from('product_skus').update({ stock_qty: newQty }).eq('id', item.skuId)
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const token       = searchParams.get('token')
  const orderNumber = searchParams.get('order')

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
    console.log('Capture status:', data.status)

    if (data.status === 'COMPLETED') {
      const { data: session } = await supabaseAdmin
        .from('paypal_sessions')
        .select('*')
        .eq('order_number', orderNumber)
        .single()

      const items  = session ? JSON.parse(session.items)  : []
      const form   = session ? JSON.parse(session.form)   : {}
      const totals = session ? JSON.parse(session.totals) : {}
      const userId = session?.user_id || null

      const itemsTotal     = parseFloat(totals.subtotal || 0)
      const shippingAmount = parseFloat(totals.shipping || 0)
      const discountAmount = parseFloat(totals.discount || 0)
      const grandTotal     = parseFloat(totals.total    || 0)

      const { data: order } = await supabaseAdmin.from('orders').insert({
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

      // 写入订单商品（包含 sku_id 和 product_id）
      if (order && items.length > 0) {
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

      if (order) {
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
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { api: 'paypal-capture', orderNumber } })
    console.error('PayPal capture error:', err)
  }

  redirect(`/order-confirmed?order=${orderNumber}`)
}
