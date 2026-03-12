import { supabaseAdmin } from '@/lib/supabase'

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

export async function POST(req) {
  try {
    const { items, form, totals } = await req.json()
    const token = await getPayPalToken()
    const now = new Date()
    const datePart = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0')
    const randPart = String(Math.floor(1000 + Math.random() * 9000))
    const orderNumber = `OSR-${datePart}-${randPart}`

    // 商品标价已含税，直接用
    const itemsTotal = items.reduce((sum, i) => sum + (parseFloat(i.price) * i.qty), 0)
    const shippingAmount = parseFloat(totals.shipping) || 0
    const grandTotal = parseFloat((itemsTotal + shippingAmount).toFixed(2))

    const paypalOrder = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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
            },
          },
          items: items.map(i => ({
            name: i.name,
            description: i.skuDesc || '',
            quantity: String(i.qty),
            unit_amount: {
              currency_code: 'GBP',
              value: parseFloat(i.price).toFixed(2),
            },
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
          cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout`,
        },
      }),
    })

    const ppData = await paypalOrder.json()
    const approvalUrl = ppData.links?.find(l => l.rel === 'approve')?.href

    if (!approvalUrl) {
      return Response.json({ error: 'PayPal did not return approval URL', details: ppData }, { status: 500 })
    }

    // 不在这里创建订单，先存临时session，支付成功后才创建正式订单
    await supabaseAdmin.from('paypal_sessions').insert({
      order_number:    orderNumber,
      paypal_order_id: ppData.id,
      items:           JSON.stringify(items),
      form:            JSON.stringify(form),
      totals:          JSON.stringify({ subtotal: itemsTotal.toFixed(2), shipping: shippingAmount.toFixed(2), total: grandTotal.toFixed(2) }),
      expires_at:      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })

    return Response.json({ approvalUrl })
  } catch (err) {
    console.error('PayPal error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
