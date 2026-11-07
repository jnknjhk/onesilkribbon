import { supabaseAdmin } from '@osr/core/lib/supabase'
import { computeAuthoritativeOrder } from '@/lib/order-pricing'
import { getAuthUser } from '@osr/core/lib/get-auth-user'
import { errorResponse } from '@osr/core/lib/api-error'
import { newOrderNumber, orderRecord, prepareOrder } from '@/lib/payment-orders'
import { checkoutForm } from '@/lib/checkout-form'
import { createCancelProof } from '@/lib/payment-proof'
import { releaseFailedPayPalCreation } from '@/lib/paypal-payment'
import { refreshCheckoutReservations } from '@/lib/stripe-reservations'

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
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error('PayPal authentication failed')
  return data.access_token
}

export async function POST(req) {
  let orderNumber
  let prepared = false
  try {
    const { items, form: rawForm, coupon } = (await req.json()) || {}
    const form = checkoutForm(rawForm)
    await refreshCheckoutReservations()
    // userId 绝不信任客户端传的值，从 token/cookie 里解析出真正登录的用户
    const authUser = await getAuthUser(req)
    const userId = authUser?.id || null

    // 服务端重新核算价格与库存，绝不信任客户端传来的 totals/price
    const priced = await computeAuthoritativeOrder({ items, couponCode: coupon?.code })
    if (!priced.ok) {
      return Response.json({ error: priced.error, unavailable: priced.unavailable }, { status: 409 })
    }
    const { lineItems: orderLineItems, totals } = priced

    orderNumber = newOrderNumber()

    const itemsTotal     = Number(totals.subtotal)
    const discountAmount = parseFloat(totals.discount) || 0
    const shippingAmount = parseFloat(totals.shipping) || 0
    const grandTotal     = parseFloat(totals.total)

    // Persist the complete order before creating a payable provider order.
    await prepareOrder(orderRecord({ orderNumber, form,
      totals: { ...totals, subtotal: itemsTotal.toFixed(2) }, userId, provider: 'paypal' }), orderLineItems)
    prepared = true
    const token = await getPayPalToken()

    const paypalOrder = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'PayPal-Request-Id': orderNumber.slice(-36),
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderNumber,
          description: 'One Silk Ribbon order',
          amount: {
            currency_code: 'GBP',
            value: grandTotal.toFixed(2),
            breakdown: {
              item_total: { currency_code: 'GBP', value: itemsTotal.toFixed(2) },
              shipping:   { currency_code: 'GBP', value: shippingAmount.toFixed(2) },
              discount:   { currency_code: 'GBP', value: discountAmount.toFixed(2) },
            },
          },
          items: orderLineItems.map(i => ({
            name: i.name,
            description: i.skuDesc || '',
            quantity: String(i.qty),
            unit_amount: { currency_code: 'GBP', value: parseFloat(i.price).toFixed(2) },
            category: 'PHYSICAL_GOODS',
          })),
          shipping: {
            name: { full_name: `${form.firstName} ${form.lastName}` },
            address: {
              address_line_1: form.line1,
              address_line_2: form.line2 || '',
              admin_area_2:   form.city,
              postal_code:    form.postcode || '',
              country_code:   form.country,
            },
          },
        }],
        application_context: {
          brand_name: 'One Silk Ribbon',
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/paypal/capture?order=${orderNumber}`,
          cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/paypal/cancel?order=${encodeURIComponent(orderNumber)}&proof=${encodeURIComponent(createCancelProof(orderNumber))}`,
        },
      }),
    })

    const ppData = await paypalOrder.json()
    const approvalUrl = ppData.links?.find(l => l.rel === 'approve')?.href

    if (!paypalOrder.ok || !approvalUrl || !ppData.id) {
      // Throw so the catch block releases the stock reservation as well.
      throw new Error('PayPal did not return approval URL')
    }

    // 存临时 session（服务端权威价格），支付成功后才创建正式订单
    const { error: saveError } = await supabaseAdmin.from('paypal_sessions').insert({
      order_number:    orderNumber,
      paypal_order_id: ppData.id,
      items:           JSON.stringify(orderLineItems),
      form:            JSON.stringify(form),
      totals:          JSON.stringify({
        subtotal:    itemsTotal.toFixed(2),
        shipping:    shippingAmount.toFixed(2),
        discount:    discountAmount.toFixed(2),
        total:       grandTotal.toFixed(2),
        couponCode:  totals.couponCode || '',
      }),
      user_id:         userId || null,
      expires_at:      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })

    if (saveError) throw saveError

    return Response.json({ approvalUrl })
  } catch (err) {
    // From the customer's point of view this checkout never received an approval URL.
    // Release the local reservation instead of leaving stock locked for up to 2 hours.
    if (prepared && orderNumber) {
      try {
        await releaseFailedPayPalCreation(orderNumber)
      } catch (releaseError) {
        console.error('[paypal-create-order] reservation release failed; manual reconciliation required', {
          orderNumber,
          error: releaseError?.message,
        })
      }
    }
    if (err?.code === 'INVALID_CHECKOUT_FORM' || err instanceof SyntaxError) return Response.json({ error: 'Please check your contact and delivery details.' }, { status: 400 })
    if (err?.code === 'P0001') return Response.json({ error: 'Stock or promo availability changed. Please review your basket and try again.' }, { status: 409 })
    return errorResponse(err, { tag: 'paypal-create-order' })
  }
}
