import { supabaseAdmin } from '@osr/core/lib/supabase'
import { errorResponse } from '@osr/core/lib/api-error'
import { recoverPayPal } from '@/lib/paypal-payment'
import { recordExternalRefund } from '@/lib/payment-orders'

const BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const received = () => Response.json({ received: true })

async function getAccessToken() {
  const response = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(
        `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
      ).toString('base64'),
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error('PayPal authentication failed')
  return data.access_token
}

async function sessionForPayPalOrder(paypalOrderId) {
  if (!paypalOrderId) return null
  const { data, error } = await supabaseAdmin.from('paypal_sessions')
    .select('order_number').eq('paypal_order_id', paypalOrderId).maybeSingle()
  if (error) throw error
  return data || null
}

async function orderForCapture(captureId) {
  if (!captureId) return null
  const { data: receipt, error } = await supabaseAdmin.from('payment_receipts')
    .select('order_number').eq('provider', 'paypal').eq('payment_id', captureId).maybeSingle()
  if (error) throw error
  if (receipt?.order_number) {
    const { data, error: orderError } = await supabaseAdmin.from('orders')
      .select('order_number,total_gbp,status,payment_method').eq('order_number', receipt.order_number).maybeSingle()
    if (orderError) throw orderError
    return data?.payment_method === 'paypal' ? data : null
  }
  const { data, error: orderError } = await supabaseAdmin.from('orders')
    .select('order_number,total_gbp,status,payment_method').eq('payment_intent_id', captureId).maybeSingle()
  if (orderError) throw orderError
  return data?.payment_method === 'paypal' ? data : null
}

export async function POST(req) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return Response.json({ error: 'PayPal webhook is not configured' }, { status: 503 })
  }

  let event
  try { event = await req.json() } catch {
    return Response.json({ error: 'Invalid webhook body' }, { status: 400 })
  }

  const header = name => req.headers.get(name)
  const authAlgo = header('paypal-auth-algo')
  const certUrl = header('paypal-cert-url')
  const transmissionId = header('paypal-transmission-id')
  const transmissionSig = header('paypal-transmission-sig')
  const transmissionTime = header('paypal-transmission-time')
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return Response.json({ error: 'Missing PayPal signature headers' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    const verification = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const result = await verification.json().catch(() => ({}))
    if (!verification.ok || result.verification_status !== 'SUCCESS') {
      return Response.json({ error: 'PayPal signature verification failed' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'PayPal verification unavailable' }, { status: 503 })
  }

  try {
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id
      const session = await sessionForPayPalOrder(paypalOrderId)
      if (session?.order_number) {
        // Retrieve the provider result and finalize the existing order idempotently.
        await recoverPayPal(session.order_number, paypalOrderId, { capture: false })
      }
      return received()
    }

    if (event.event_type === 'PAYMENT.CAPTURE.DENIED' || event.event_type === 'PAYMENT.CAPTURE.FAILED') {
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id
      const session = await sessionForPayPalOrder(paypalOrderId)
      if (session?.order_number) {
        const { data: order, error } = await supabaseAdmin.from('orders')
          .select('status').eq('order_number', session.order_number).maybeSingle()
        if (error) throw error
        if (order?.status === 'pending') {
          const { error: releaseError } = await supabaseAdmin.rpc('release_checkout_reservation', {
            p_order_number: session.order_number,
            p_reason: 'PayPal 付款失败',
          })
          if (releaseError) throw releaseError
        }
      }
      return received()
    }

    if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED' || event.event_type === 'PAYMENT.CAPTURE.REVERSED') {
      const resource = event.resource || {}
      const captureId = resource.supplementary_data?.related_ids?.capture_id ||
        (resource.links || []).find(link => link.rel === 'up')?.href?.split('/').pop()
      if (!captureId) return received()
      if (resource.status && resource.status !== 'COMPLETED') return received()

      const amountPence = Math.round(Number(resource.amount?.value) * 100)
      const currency = String(resource.amount?.currency_code || '').toUpperCase()
      if (!Number.isSafeInteger(amountPence) || amountPence <= 0 || !/^[A-Z]{3}$/.test(currency)) {
        return received()
      }
      const order = await orderForCapture(captureId)
      if (!order) return received()
      const full = amountPence >= Math.round(Number(order.total_gbp) * 100)
      await recordExternalRefund({
        provider: 'paypal',
        refundId: String(resource.id || `${captureId}:${amountPence}`),
        orderNumber: order.order_number,
        paymentId: captureId,
        amountPence,
        currency,
        full,
        evidence: { event_id: event.id || null, capture_id: captureId, refund_status: resource.status || null },
      })
      return received()
    }

    return received()
  } catch (err) {
    return errorResponse(err, { status: 503, tag: 'paypal-webhook' })
  }
}
