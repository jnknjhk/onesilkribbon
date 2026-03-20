import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const orderNumber = session.metadata?.orderNumber

      if (orderNumber) {
        await supabaseAdmin.from('orders')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('order_number', orderNumber)

        const { data: order } = await supabaseAdmin.from('orders')
          .select('*').eq('order_number', orderNumber).single()

        if (order) {
          const form = {
            email:     order.customer_email,
            firstName: (order.shipping_name || '').split(' ')[0],
            lastName:  (order.shipping_name || '').split(' ').slice(1).join(' '),
            line1:     order.shipping_line1,
            line2:     order.shipping_line2 || '',
            city:      order.shipping_city,
            postcode:  order.shipping_postcode,
            country:   order.shipping_country,
            phone:     '',
            dialCode:  '',
          }
          const totals = {
            subtotal:    order.subtotal_gbp,
            shipping:    order.shipping_gbp,
            total:       order.total_gbp,
            freeShipping: parseFloat(order.shipping_gbp) === 0,
          }
          const items = [{
            name:    'One Silk Ribbon Order',
            skuDesc: '',
            price:   parseFloat(order.subtotal_gbp),
            qty:     1,
          }]

          try {
            await sendOrderConfirmation({ order, items, form, totals })
            await sendOwnerNotification({ order, items, form, totals })
          } catch (e) {
            console.error('Email send failed:', e)
          }
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      await supabaseAdmin.from('orders')
        .update({ status: 'cancelled' })
        .eq('payment_intent_id', pi.id)
      break
    }
  }

  return Response.json({ received: true })
}
