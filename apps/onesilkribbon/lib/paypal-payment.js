import { supabaseAdmin } from '@osr/core/lib/supabase'
import { prepareOrder, orderRecord, recordPayment, completeOrder, deliverNotifications } from '@/lib/payment-orders'

const BASE = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
const parse = value => typeof value === 'string' ? JSON.parse(value) : value

export async function getPayPalOrder(token) {
  const response = await fetch(BASE + '/v1/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_SECRET).toString('base64') },
    body: 'grant_type=client_credentials',
  })
  const auth = await response.json()
  if (!response.ok || !auth.access_token) throw new Error('PayPal authentication failed')
  const result = await fetch(BASE + '/v2/checkout/orders/' + encodeURIComponent(token), {
    headers: { Authorization: 'Bearer ' + auth.access_token },
  })
  if (!result.ok) throw new Error('PayPal lookup failed; reservation retained')
  return result.json()
}

export async function recoverPayPal(orderNumber, token, { capture = true } = {}) {
  const { data: session, error: readError } = await supabaseAdmin.from('paypal_sessions')
    .select('*').eq('order_number', orderNumber).maybeSingle()
  if (readError) throw readError
  if (!session) {
    // Previously completed orders had their sessions deleted. Do not charge them again.
    const { data: oldOrder, error } = await supabaseAdmin.from('orders').select('payment_method,payment_intent_id,status')
      .eq('order_number', orderNumber).maybeSingle()
    if (error) throw error
    if (oldOrder?.payment_method === 'paypal' && oldOrder.payment_intent_id === token &&
        ['paid', 'shipped', 'delivered', 'refunded'].includes(oldOrder.status)) return
    throw new Error('PayPal recovery session missing')
  }
  if (session.paypal_order_id !== token) throw new Error('PayPal order/token mismatch')
  const { data: saved, error: savedError } = await supabaseAdmin.from('orders').select('*')
    .eq('order_number', orderNumber).maybeSingle()
  if (savedError) throw savedError
  const { data: snapshot, error: snapshotError } = await supabaseAdmin.from('payment_checkouts')
    .select('order_number').eq('order_number', orderNumber).maybeSingle()
  if (snapshotError) throw snapshotError
  if (!snapshot) {
    if (saved && saved.status !== 'pending') {
      if (saved.payment_method !== 'paypal' || saved.payment_intent_id !== token) throw new Error('Legacy payment mismatch')
      return
    }
    // Preserve old in-flight PayPal checkouts before requesting capture.
    await prepareOrder({ ...orderRecord({ orderNumber, form: parse(session.form), totals: parse(session.totals),
      userId: session.user_id, provider: 'paypal' }), managedCapture: false }, parse(session.items))
  }
  const authRes = await fetch(BASE + '/v1/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_SECRET).toString('base64') },
    body: 'grant_type=client_credentials',
  })
  const auth = await authRes.json()
  if (!authRes.ok || !auth.access_token) throw new Error('PayPal authentication failed')
  const headers = { Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json' }
  const readProvider = async () => {
    const response = await fetch(BASE + '/v2/checkout/orders/' + encodeURIComponent(token), { headers })
    const data = await response.json()
    if (!response.ok) throw new Error('PayPal order lookup failed')
    return data
  }
  // Always retrieve first: an earlier request may have captured successfully before timing out.
  let data = await readProvider()
  if (data.status !== 'COMPLETED' && capture && data.status === 'APPROVED') {
    // Serialize capture eligibility against cancellation before making the external call.
    const { error: captureError } = await supabaseAdmin.rpc('begin_paypal_capture', { p_order_number: orderNumber })
    if (captureError) throw captureError
    try {
      const response = await fetch(BASE + '/v2/checkout/orders/' + encodeURIComponent(token) + '/capture', {
        method: 'POST', headers: { ...headers, 'PayPal-Request-Id': 'capture-' + token },
      })
      if (response.ok) data = await response.json()
    } catch (err) { console.warn('PayPal capture response unavailable; checking provider', token) }
    if (data.status !== 'COMPLETED') data = await readProvider()
  }
  const units = data.purchase_units || []
  const captures = units.flatMap(u => u.payments?.captures || [])
  if (data.id !== token || data.status !== 'COMPLETED' || units.length !== 1 ||
      units[0].reference_id !== orderNumber || captures.length !== 1 || captures[0].status !== 'COMPLETED') {
    throw new Error('PayPal payment not completed or identity mismatch')
  }
  const payment = captures[0]
  const amountPence = Math.round(Number(payment.amount?.value) * 100)
  await recordPayment({ provider: 'paypal', paymentId: payment.id, orderNumber,
    amountPence, currency: payment.amount?.currency_code, evidence: data })
  await completeOrder('paypal', payment.id)
  await deliverNotifications(orderNumber)
  // Keep the session and evidence for reconciliation; never delete after partial failure.
}
