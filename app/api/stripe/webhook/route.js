import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

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
        // Mark order as paid
        await supabaseAdmin.from('orders')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('order_number', orderNumber)

        console.log(`✅ Order ${orderNumber} marked as paid`)
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
