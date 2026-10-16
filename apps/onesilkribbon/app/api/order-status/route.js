import { supabaseAdmin } from '@osr/core/lib/supabase'
import { paymentProofDetails, readConfirmationCookie } from '@/lib/payment-proof'

export const dynamic = 'force-dynamic'
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(req) {
  const params = new URL(req.url).searchParams
  const orderNumber = params.get('order')
  if (!orderNumber || orderNumber.length > 100 || params.has('proof') || params.has('session_id')) {
    return reply({ error: 'Payment verification link required' }, 400)
  }
  const proof = paymentProofDetails(readConfirmationCookie(req,orderNumber),orderNumber)
  if (!proof) return reply({error:'Payment verification link required'},400)
  const { data: order, error } = await supabaseAdmin.from('orders')
    .select('status,payment_method,payment_intent_id').eq('order_number', orderNumber).maybeSingle()
  if (error) return reply({ error: 'Verification temporarily unavailable' }, 503)
  if (!order) {
    return reply({ error: 'Payment verification link invalid' }, 404)
  }
  return reply({ status: ['paid', 'shipped', 'delivered'].includes(order.status) ? 'confirmed' : order.status === 'pending' ? 'pending' : 'not-confirmed',
    ...(/^[a-f0-9]{64}$/.test(proof.checkoutReference || '') ? {checkoutReference:proof.checkoutReference} : {}),
  })
}
