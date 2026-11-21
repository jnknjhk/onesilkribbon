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
    Stripe: class {
      webhooks = { constructEvent: () => event }
      refunds = { list: async function* ({ charge }) {
        assert.equal(charge, 'ch_1')
        yield* options.listedRefunds || []
      } }
    },
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
    } },
  }
  const h = stripeRoute(event, { listedRefunds: [
    { id: 're_1', amount: 2000, currency: 'gbp', status: 'succeeded', payment_intent: 'pi_1' },
    { id: 're_pending', amount: 100, currency: 'gbp', status: 'pending' },
  ] })
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

function paypalRoute(event, { verify = 'SUCCESS', captureResponse, ...options } = {}) {
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
      if (String(url).includes('/v2/payments/captures/')) return captureResponse
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
    assert.deepEqual(h.rpc, [{ name: 'release_failed_paypal_capture', args: { p_paypal_order_id: 'PP1' } }])
  }
})

test('PayPal approval webhook captures only a pending matching PayPal order', async () => {
  const event = { event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'PP1' } }
  const ready = paypalRoute(event, { order: { status:'pending', payment_method:'paypal' } })
  assert.equal((await ready.POST(ready.req())).status, 200)
  assert.deepEqual(ready.recovered, [['OSR-1','PP1']])
  for (const options of [{ session:null }, {order:{status:'cancelled',payment_method:'paypal'}},
    {order:{status:'pending',payment_method:'stripe'}}, {verify:'FAILURE'}]) {
    const ignored = paypalRoute(event, options)
    assert.equal((await ignored.POST(ignored.req())).status, options.verify ? 400 : 200)
    assert.deepEqual(ignored.recovered, [])
  }
})

test('PayPal refunds use cumulative totals while recording only the individual refund amount', async () => {
  for (const [total, full] of [['8.00', false], ['20.00', true]]) {
    const h = paypalRoute({event_type:'PAYMENT.CAPTURE.REFUNDED', resource:{
      id:'RE-2',status:'COMPLETED', amount:{value:'8.00',currency_code:'GBP'},
      seller_payable_breakdown:{total_refunded_amount:{value:total,currency_code:'GBP'}},
      supplementary_data:{related_ids:{capture_id:'CAP1'}},
    }})
    assert.equal((await h.POST(h.req())).status,200)
    assert.equal(h.refunds[0].full,full)
    assert.equal(h.refunds[0].amountPence,800)
    assert.equal(h.fetchCalls(),2)
  }
})

test('PayPal refund with no cumulative total verifies the capture or retries without recording', async () => {
  const event={event_type:'PAYMENT.CAPTURE.REFUNDED', resource:{
    id:'RE-2',status:'COMPLETED',amount:{value:'8.00',currency_code:'GBP'},
    supplementary_data:{related_ids:{capture_id:'CAP1'}},
  }}
  const confirmed=paypalRoute(event,{captureResponse:Response.json({id:'CAP1',status:'REFUNDED',amount:{value:'20.00',currency_code:'GBP'}})})
  assert.equal((await confirmed.POST(confirmed.req())).status,200)
  assert.equal(confirmed.refunds[0].full,true)
  assert.equal(confirmed.refunds[0].amountPence,800)
  const unavailable=paypalRoute(event,{captureResponse:Response.json({}, {status:503})})
  assert.equal((await unavailable.POST(unavailable.req())).status,503)
  assert.deepEqual(unavailable.refunds,[])
})
