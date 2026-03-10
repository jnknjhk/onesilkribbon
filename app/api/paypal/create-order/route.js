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

    // 计算 items 实际总额（含VAT），确保与 total 一致
    const itemsTotal = items.reduce((sum, i) => sum + (parseFloat(i.price) * i.qty), 0)
    const vatRate = 0.20
    const itemsTotalIncVat = parseFloat((itemsTotal * (1 + vatRate)).toFixed(2))
    const shippingAmount = parseFloat(totals.shipping) || 0
    const grandTotal = parseFloat((itemsTotalIncVat + shippingAmount).toFixed(2))

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
              item_total: { currency_code: 'GBP', value: itemsTotalIncVat.toFixed(2) },
              shipping:   { currency_code: 'GBP', value: shippingAmount.toFixed(2) },
            },
          },
          items: items.map(i => ({
            name: i.name,
            description: i.skuDesc || '',
            quantity: String(i.qty),
            unit_amount: {
              currency_code: 'GBP',
              value: parseFloat((parseFloat(i.price) * (1 + vatRate)).toFixed(2)).toFixed(2),
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
    console.log('PayPal response:', JSON.stringify(ppData))
    const approvalUrl = ppData.links?.find(l => l.rel === 'approve')?.href

    if (!approvalUrl) {
      return Response.json({ error: 'PayPal did not return approval URL', details: ppData }, { status: 500 })
    }

    await supabaseAdmin.from('orders').insert({
      order_number:      orderNumber,
      customer_email:    form.email,
      status:            'pending',
      subtotal_gbp:      itemsTotalIncVat.toFixed(2),
      vat_amount_gbp:    totals.vatAmount,
      shipping_gbp:      shippingAmount.toFixed(2),
      total_gbp:         grandTotal.toFixed(2),
      shipping_name:     `${form.firstName} ${form.lastName}`,
      shipping_line1:    form.line1,
      shipping_line2:    form.line2 || null,
      shipping_city:     form.city,
      shipping_postcode: form.postcode || '',
      shipping_country:  form.country,
      payment_method:    'paypal',
      payment_intent_id: ppData.id,
    })

    return Response.json({ approvalUrl })
  } catch (err) {
    console.error('PayPal error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
