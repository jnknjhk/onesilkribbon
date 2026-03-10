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

    if (data.status === 'COMPLETED') {
      // Update order status
      await supabaseAdmin.from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('order_number', orderNumber)

      // Fetch full order details for email
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single()

      // Fetch order items
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_number', orderNumber)

      if (order) {
        const form = {
          firstName: order.shipping_name?.split(' ')[0] || '',
          lastName:  order.shipping_name?.split(' ').slice(1).join(' ') || '',
          email:     order.customer_email,
          line1:     order.shipping_line1,
          line2:     order.shipping_line2,
          city:      order.shipping_city,
          postcode:  order.shipping_postcode,
          country:   order.shipping_country,
          phone:     order.customer_phone || '',
          dialCode:  '',
        }

        const totals = {
          subtotalExVat: order.subtotal_gbp,
          vatAmount:     order.vat_amount_gbp,
          shipping:      order.shipping_gbp,
          total:         order.total_gbp,
          freeShipping:  parseFloat(order.shipping_gbp) === 0,
        }

        const items = orderItems || []

        // Send emails (don't block redirect if email fails)
        Promise.all([
          sendOrderConfirmation({ order, items, form, totals }),
          sendOwnerNotification({ order, items, form, totals }),
        ]).catch(err => console.error('Email error:', err))
      }
    }
  } catch (err) {
    console.error('PayPal capture error:', err)
  }

  redirect(`/order-confirmed?order=${orderNumber}`)
}
