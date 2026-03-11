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
    console.log('Capture status:', data.status)

    if (data.status === 'COMPLETED') {
      // Update order status
      await supabaseAdmin.from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('order_number', orderNumber)

      // Fetch order
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single()

      console.log('Order fetch:', order?.order_number, orderError?.message)

      if (order) {
        const nameParts = (order.shipping_name || '').split(' ')
        const form = {
          firstName: nameParts[0] || '',
          lastName:  nameParts.slice(1).join(' ') || '',
          email:     order.customer_email,
          line1:     order.shipping_line1 || '',
          line2:     order.shipping_line2 || '',
          city:      order.shipping_city || '',
          postcode:  order.shipping_postcode || '',
          country:   order.shipping_country || '',
          phone:     '',
          dialCode:  '',
        }

        const totals = {
          subtotal:      parseFloat(order.subtotal_gbp || 0).toFixed(2),
          shipping:      parseFloat(order.shipping_gbp || 0).toFixed(2),
          total:         parseFloat(order.total_gbp || 0).toFixed(2),
          freeShipping:  parseFloat(order.shipping_gbp || 0) === 0,
        }

        // Send both emails, log any errors
        try {
          await sendOrderConfirmation({ order, items: [], form, totals })
          console.log('Order confirmation sent to:', form.email)
        } catch (e) {
          console.error('Order confirmation email error:', e.message)
        }

        try {
          await sendOwnerNotification({ order, items: [], form, totals })
          console.log('Owner notification sent')
        } catch (e) {
          console.error('Owner notification email error:', e.message)
        }
      }
    }
  } catch (err) {
    console.error('PayPal capture error:', err)
  }

  redirect(`/order-confirmed?order=${orderNumber}`)
}
