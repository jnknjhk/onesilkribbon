import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyPaymentProof } from '@/lib/payment-proof'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(req) {
  const params = new URL(req.url).searchParams
  const orderNumber = params.get('order')
  const sessionId = params.get('session_id')
  const proofValid = verifyPaymentProof(params.get('proof'), orderNumber)
  if (!orderNumber || orderNumber.length > 100 || (!proofValid && !/^cs_[A-Za-z0-9_]{20,250}$/.test(sessionId || ''))) {
    return reply({ error: 'Payment verification link required' }, 400)
  }
  const { data: order, error } = await supabaseAdmin.from('orders')
    .select('status,payment_method,payment_intent_id').eq('order_number', orderNumber).maybeSingle()
  if (error) return reply({ error: 'Verification temporarily unavailable' }, 503)
  let stripeValid = false
  if (!proofValid && order?.payment_method === 'stripe') {
    try {
      const session = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sessionId)
      stripeValid = session.metadata?.orderNumber === orderNumber &&
        [session.id, typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id].includes(order.payment_intent_id)
    } catch { return reply({ error: 'Verification temporarily unavailable' }, 503) }
  }
  if (!order || (!proofValid && !stripeValid)) {
    return reply({ error: 'Payment verification link invalid' }, 404)
  }
  return reply({ status: ['paid', 'shipped', 'delivered'].includes(order.status) ? 'confirmed' : order.status === 'pending' ? 'pending' : 'not-confirmed' })
}
