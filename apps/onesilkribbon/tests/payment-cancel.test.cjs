const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHmac, timingSafeEqual, createHash } = require('node:crypto')
const { NextRequest, NextResponse } = require('next/server')

process.env.SUPABASE_SERVICE_KEY = 'test-cancel-key'
process.env.NEXT_PUBLIC_SITE_URL = 'https://onesilkribbon.com'
process.env.PAYPAL_MODE = 'sandbox'
process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = 'test-client'
process.env.PAYPAL_SECRET = 'test-secret'

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const load = (file, bindings, name) => {
  const source = read(file)
    .replace(/^import .*$/gm, '')
    .replace(/^export async function/gm, 'async function')
    .replace(/^export (?=const |function )/gm, '')
  return new Function(...Object.keys(bindings), source + `;return ${name}`)(...Object.values(bindings))
}

test('cancel proof only validates the matching order and rejects tampering', () => {
  const create = load('lib/payment-proof.js', { createHmac, timingSafeEqual, createHash }, 'createCancelProof')
  const verify = load('lib/payment-proof.js', { createHmac, timingSafeEqual, createHash }, 'verifyCancelProof')
  const proof = create('OSR-TEST')
  assert.equal(verify(proof, 'OSR-TEST'), true)
  assert.equal(verify(proof, 'OSR-OTHER'), false)
  assert.equal(verify(proof.slice(0, -1) + (proof.endsWith('a') ? 'b' : 'a'), 'OSR-TEST'), false)
  assert.equal(verify('not-a-proof', 'OSR-TEST'), false)
})

test('Stripe cancel redirects to the basket only after the provider confirms cancellation', async () => {
  const make = overrides => load('app/api/stripe/cancel/route.js', {
    NextResponse,
    verifyCancelProof: () => true,
    reconcileStripeReservation: async () => ({ status: 'cancelled' }),
    ...overrides,
  }, 'GET')
  const request = () => new NextRequest('https://onesilkribbon.com/api/stripe/cancel?order=OSR-TEST&proof=x')

  let response = await make()(request())
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=cancelled')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')

  response = await make({ verifyCancelProof: () => false })(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=cancel_failed')

  response = await make({ reconcileStripeReservation: async () => ({ status: 'paid' }) })(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=already_paid')

  response = await make({ reconcileStripeReservation: async () => { throw new Error('provider down') } })(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=cancel_failed')
})

test('PayPal cancel releases the local reservation only when no capture exists', async () => {
  const make = ({ session = { paypal_order_id: 'PP1' }, provider = { status: 'CREATED' }, rpcError = null, getPayPalOrder } = {}) => {
    const calls = { rpc: [], recovered: 0 }
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: session, error: null }) }),
        }),
      }),
      rpc: async (name, args) => {
        calls.rpc.push({ name, args })
        return { error: rpcError }
      },
    }
    const GET = load('app/api/paypal/cancel/route.js', {
      NextResponse,
      verifyCancelProof: () => true,
      supabaseAdmin: db,
      getPayPalOrder: getPayPalOrder || (async () => provider),
      recoverPayPal: async () => { calls.recovered++ },
    }, 'GET')
    return { calls, GET }
  }
  const request = () => new NextRequest('https://onesilkribbon.com/api/paypal/cancel?order=OSR-TEST&proof=x')

  let h = make()
  let response = await h.GET(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=cancelled')
  assert.deepEqual(h.calls.rpc, [{
    name: 'release_checkout_reservation',
    args: { p_order_number: 'OSR-TEST', p_reason: 'PayPal 付款已取消' },
  }])
  assert.equal(h.calls.recovered, 0)

  h = make({ provider: { status: 'COMPLETED', purchase_units: [] } })
  response = await h.GET(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=already_paid')
  assert.equal(h.calls.rpc.length, 0)
  assert.equal(h.calls.recovered, 1)

  h = make({ session: null })
  response = await h.GET(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=cancelled')
  assert.equal(h.calls.rpc.length, 1)

  h = make({ getPayPalOrder: async () => { throw new Error('PayPal order not found') } })
  response = await h.GET(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=cancelled')
  assert.equal(h.calls.rpc.length, 1)

  h = make({ rpcError: new Error('Payment evidence exists; reconcile before cancellation') })
  response = await h.GET(request())
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/checkout?payment_error=already_paid')
})

test('checkout blocks a second submit before React re-renders', () => {
  const checkout = read('app/checkout/page.jsx')
  assert.match(checkout, /submittingRef\.current = true/)
  assert.match(checkout, /Promise\.resolve\(request\)\.finally/)
  assert.match(read('app/api/paypal/create-order/route.js'), /releaseFailedPayPalCreation/)
  assert.match(read('app/api/stripe/create-checkout-session/route.js'), /createCancelProof/)
})

test('PayPal create-order releases the reservation when no approval URL can be returned', async () => {
  const make = ({ orderResponse = Response.json({ id: 'PP1', links: [{ rel: 'approve', href: 'https://paypal.test/approve' }] }), insertError = null } = {}) => {
    const released = []
    let cancelUrl = ''
    const POST = load('app/api/paypal/create-order/route.js', {
      supabaseAdmin: { from: () => ({ insert: async () => ({ error: insertError }) }) },
      computeAuthoritativeOrder: async () => ({
        ok: true,
        lineItems: [{ name: 'Silk', skuDesc: '7mm', qty: 1, price: '10' }],
        totals: { subtotal: '10', shipping: '0', discount: '0', total: '10', couponCode: '' },
      }),
      getAuthUser: async () => null,
      errorResponse: () => Response.json({ error: 'retry' }, { status: 503 }),
      newOrderNumber: () => 'OSR-2026-TEST',
      orderRecord: () => ({}),
      prepareOrder: async () => {},
      checkoutForm: value => value,
      createCancelProof: () => 'cancel-proof',
      releaseFailedPayPalCreation: async orderNumber => { released.push(orderNumber) },
      refreshCheckoutReservations: async () => {},
      fetch: async (url, options) => {
        if (String(url).endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'token' })
        cancelUrl = JSON.parse(options.body).application_context.cancel_url
        return orderResponse
      },
    }, 'POST')
    return { POST, released, cancelUrl: () => cancelUrl }
  }
  const request = () => ({ json: async () => ({ items: [], form: {} }) })

  let h = make({ orderResponse: Response.json({}, { status: 500 }) })
  let response = await h.POST(request())
  assert.equal(response.status, 503)
  assert.deepEqual(h.released, ['OSR-2026-TEST'])

  h = make({ insertError: new Error('database down') })
  response = await h.POST(request())
  assert.equal(response.status, 503)
  assert.deepEqual(h.released, ['OSR-2026-TEST'])

  h = make()
  response = await h.POST(request())
  assert.equal(response.status, 200)
  assert.equal((await response.json()).approvalUrl, 'https://paypal.test/approve')
  assert.deepEqual(h.released, [])
  assert.match(h.cancelUrl(), /\/api\/paypal\/cancel\?order=OSR-2026-TEST&proof=cancel-proof/)
})
