const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

process.env.PAYPAL_MODE = 'sandbox'
process.env.PAYPAL_WEBHOOK_ID = 'wh_test'
process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = 'test-client'
process.env.PAYPAL_SECRET = 'test-secret'

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const loadRoute = (file, bindings, exported = 'POST') => {
  const source = read(file)
    .replace(/^import .*$/gm, '')
    .replace(/^export async function/gm, 'async function')
    .replace(/^export (?=const |function )/gm, '')
  return new Function(...Object.keys(bindings), source + `;return ${exported}`)(...Object.values(bindings))
}

function stripeDb({ order, receipt = null, rpc = [] }) {
  return {
    rpc: async (name, args) => { rpc.push({ name, args }); return { error: null } },
    from(table) {
      const q = {
        select() { return q },
        eq() { return q },
        maybeSingle: async () => ({ data: table === 'orders' ? order : table === 'payment_receipts' ? receipt : null, error: null }),
        single: async () => ({ data: table === 'orders' ? order : null, error: null }),
      }
      return q
    },
  }
}

function stripeRoute(event, options = {}) {
  const refunds = []
  const rpc = []
  const POST = loadRoute('app/api/stripe/webhook/route.js', {
    Stripe: class { webhooks = { constructEvent: () => event } },
    supabaseAdmin: stripeDb({ order: options.order || { order_number: 'OSR-1', total_gbp: 20, status: 'paid', payment_method: 'stripe' }, receipt: options.receipt, rpc }),
    recordPayment: async () => {},
    recordExternalRefund: async refund => { refunds.push(refund) },
    prepareOrder: async () => {},
    completeOrder: async () => {},
    deliverNotifications: async () => {},
    stripeProviderScope: () => 'scope',
    errorResponse: () => Response.json({ error: 'retry' }, { status: 503 }),
  })
  return { POST, refunds, rpc }
}

test('Stripe full refund records the refund and marks the order refunded', async () => {
  const event = {
    type: 'charge.refunded',
    data: { object: {
      id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 2000, currency: 'gbp',
      refunded: true, metadata: { orderNumber: 'OSR-1' },
      refunds: { data: [{ id: 're_1', amount: 2000, currency: 'gbp', status: 'succeeded', payment_intent: 'pi_1' }] },
    } },
  }
  const h = stripeRoute(event)
  assert.equal((await h.POST({ text: async () => '', headers: new Headers() })).status, 200)
  assert.deepEqual(h.refunds, [{
    provider: 'stripe', refundId: 're_1', orderNumber: 'OSR-1', paymentId: 'pi_1',
    amountPence: 2000, currency: 'GBP', full: true,
    evidence: { charge_id: 'ch_1', refund_id: 're_1', status: 'succeeded', reason: null },
  }])
})

test('Stripe partial refund is recorded without full-refund status', async () => {
  const event = {
    type: 'refund.created',
    data: { object: { id: 're_2', amount: 1000, currency: 'gbp', status: 'succeeded', payment_intent: 'pi_1', charge: 'ch_1' } },
  }
  const h = stripeRoute(event, { receipt: { order_number: 'OSR-1' } })
  assert.equal((await h.POST({ text: async () => '', headers: new Headers() })).status, 200)
  assert.equal(h.refunds.length, 1)
  assert.equal(h.refunds[0].refundId, 're_2')
  assert.equal(h.refunds[0].full, false)
})

test('Stripe async payment failure releases only a pending reservation', async () => {
  const event = {
    type: 'checkout.session.async_payment_failed',
    data: { object: { metadata: { orderNumber: 'OSR-1' }, currency: 'gbp', amount_total: 2000 } },
  }
  const h = stripeRoute(event, { order: { order_number: 'OSR-1', total_gbp: 20, status: 'pending', payment_method: 'stripe' } })
  assert.equal((await h.POST({ text: async () => '', headers: new Headers() })).status, 200)
  assert.deepEqual(h.rpc, [{ name: 'release_checkout_reservation', args: { p_order_number: 'OSR-1', p_reason: 'Stripe 异步付款失败' } }])
})

test('Stripe payment_intent.payment_failed is informational and does not release stock', async () => {
  const event = { type: 'payment_intent.payment_failed', data: { object: { metadata: { orderNumber: 'OSR-1' } } } }
  const h = stripeRoute(event)
  assert.equal((await h.POST({ text: async () => '', headers: new Headers() })).status, 200)
  assert.deepEqual(h.rpc, [])
  assert.deepEqual(h.refunds, [])
})

function paypalDb({ session = { order_number: 'OSR-1' }, order = { order_number: 'OSR-1', total_gbp: 20, status: 'paid', payment_method: 'paypal' }, receipt = { order_number: 'OSR-1' }, rpc = [] }) {
  const data = table => table === 'paypal_sessions' ? session : table === 'payment_receipts' ? receipt : table === 'orders' ? order : null
  return {
    rpc: async (name, args) => { rpc.push({ name, args }); return { error: null } },
    from(table) {
      const q = { select() { return q }, eq() { return q }, maybeSingle: async () => ({ data: data(table), error: null }) }
      return q
    },
  }
}

function paypalRoute(event, { verify = 'SUCCESS', ...options } = {}) {
  const recovered = []
  const refunds = []
  const rpc = []
  let fetchCalls = 0
  const POST = loadRoute('app/api/paypal/webhook/route.js', {
    supabaseAdmin: paypalDb({ ...options, rpc }),
    recoverPayPal: async (...args) => { recovered.push(args) },
    recordExternalRefund: async refund => { refunds.push(refund) },
    errorResponse: () => Response.json({ error: 'retry' }, { status: 503 }),
    fetch: async url => {
      fetchCalls++
      if (String(url).endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'token' })
      return Response.json({ verification_status: verify })
    },
  })
  const req = () => ({
    json: async () => event,
    headers: new Headers({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/cert',
      'paypal-transmission-id': 'tid',
      'paypal-transmission-sig': 'sig',
      'paypal-transmission-time': '2026-11-07T00:00:00Z',
    }),
  })
  return { POST, recovered, refunds, rpc, req, fetchCalls: () => fetchCalls }
}

test('PayPal capture-completed webhook verifies and finalizes idempotently', async () => {
  const event = { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'PP1' } } } }
  const h = paypalRoute(event)
  assert.equal((await h.POST(h.req())).status, 200)
  assert.deepEqual(h.recovered, [['OSR-1', 'PP1', { capture: false }]])
})

test('PayPal webhook rejects an invalid signature before touching payment state', async () => {
  const event = { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'PP1' } } } }
  const h = paypalRoute(event, { verify: 'FAILURE' })
  assert.equal((await h.POST(h.req())).status, 400)
  assert.deepEqual(h.recovered, [])
})

test('PayPal full refund records the refund against the capture owner', async () => {
  const event = { event_type: 'PAYMENT.CAPTURE.REFUNDED', id: 'WH-EVT', resource: {
    id: 'RE-1', status: 'COMPLETED', amount: { value: '20.00', currency_code: 'GBP' },
    supplementary_data: { related_ids: { capture_id: 'CAP1' } },
  } }
  const h = paypalRoute(event)
  assert.equal((await h.POST(h.req())).status, 200)
  assert.deepEqual(h.refunds, [{
    provider: 'paypal', refundId: 'RE-1', orderNumber: 'OSR-1', paymentId: 'CAP1',
    amountPence: 2000, currency: 'GBP', full: true,
    evidence: { event_id: 'WH-EVT', capture_id: 'CAP1', refund_status: 'COMPLETED' },
  }])
})

test('PayPal denied or declined capture releases a pending reservation', async () => {
  for (const type of ['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED']) {
    const event = { event_type: type, resource: { supplementary_data: { related_ids: { order_id: 'PP1' } } } }
    const h = paypalRoute(event, { order: { order_number: 'OSR-1', total_gbp: 20, status: 'pending', payment_method: 'paypal' } })
    assert.equal((await h.POST(h.req())).status, 200)
    assert.deepEqual(h.rpc, [{ name: 'release_checkout_reservation', args: { p_order_number: 'OSR-1', p_reason: 'PayPal 付款失败' } }])
  }
})
