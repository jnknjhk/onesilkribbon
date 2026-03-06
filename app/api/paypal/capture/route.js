import { supabaseAdmin } from '@/lib/supabase'
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

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const token     = searchParams.get('token')      // PayPal order ID
  const orderNumber = searchParams.get('order')

  try {
    const accessToken = await getPayPalToken()

    // Capture the payment
    const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    const data = await capture.json()

    if (data.status === 'COMPLETED') {
      await supabaseAdmin.from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('order_number', orderNumber)
    }
  } catch (err) {
    console.error('PayPal capture error:', err)
  }

  redirect(`/order-confirmed?order=${orderNumber}`)
}
