import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { confirmationResponse } from '@/lib/confirmation-response'
import { paymentProofDetails, checkoutReference } from '@/lib/payment-proof'

export const dynamic = 'force-dynamic'
const failure = () => Response.json({ error:'Payment confirmation could not be verified. Please check your account or contact support.' },
  {status:400,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
const pending = () => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment confirmation pending</title></head><body style="font-family:system-ui;max-width:600px;margin:100px auto;padding:24px"><h1>Payment confirmation pending</h1><p>Please do not pay again. Your existing order details have been retained.</p><p>We could not reach the payment service. Refresh this page shortly to retry confirmation.</p><button type="button" onclick="location.reload()">Retry confirmation</button><p><a href="/account">View your account</a> · <a href="mailto:song@onesilkribbon.com">Contact support</a></p></body></html>`,{
  status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','Retry-After':'10'},
})

export async function GET(req) {
  const params = new URL(req.url).searchParams
  const order = params.get('order')
  if (!order || order.length>100) return failure()
  // Old emailed/bookmarked proof URLs remain usable, but never render a page
  // carrying that bearer token: exchange it for a scoped HttpOnly cookie first.
  const proof = params.get('proof')
  if (proof) {
    const details = paymentProofDetails(proof,order)
    return details ? confirmationResponse(req,order,details.checkoutReference,proof) : failure()
  }
  const sessionId = params.get('session_id')
  if (!/^cs_[A-Za-z0-9_]{20,250}$/.test(sessionId || '')) return failure()
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:1})
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const {data:saved,error} = await supabaseAdmin.from('orders').select('payment_method,payment_intent_id,total_gbp')
      .eq('order_number',order).maybeSingle()
    const paymentId = typeof session.payment_intent==='string' ? session.payment_intent : session.payment_intent?.id
    if (error) return pending()
    if (!saved || saved.payment_method!=='stripe' || session.metadata?.orderNumber!==order ||
      session.payment_status!=='paid' || session.currency!=='gbp' || session.amount_total!==Math.round(Number(saved.total_gbp)*100) ||
      ![session.id,paymentId].includes(saved.payment_intent_id)) return failure()
    return confirmationResponse(req,order,checkoutReference(sessionId))
  } catch (error) { return error?.code==='resource_missing' ? failure() : pending() }
}
