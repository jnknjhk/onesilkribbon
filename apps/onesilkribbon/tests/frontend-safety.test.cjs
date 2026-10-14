const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

test('PayPal confirmation proof rejects tampering, wrong order and expiration', async () => {
  process.env.SUPABASE_SERVICE_KEY = 'test-only-secret'
  const { createPaymentProof, verifyPaymentProof } = await load(read('lib/payment-proof.js'))
  const proof = createPaymentProof('OSR-TEST')
  assert.equal(verifyPaymentProof(proof, 'OSR-TEST'), true)
  assert.equal(verifyPaymentProof(proof, 'OSR-OTHER'), false)
  assert.equal(verifyPaymentProof(proof + '0', 'OSR-TEST'), false)
  assert.equal(verifyPaymentProof(null, 'OSR-TEST'), false)
  const originalNow = Date.now
  try {
    Date.now = () => originalNow() + 86400001
    assert.equal(verifyPaymentProof(proof, 'OSR-TEST'), false)
  } finally { Date.now = originalNow }
})

test('description filtering removes scripts, handlers and unsafe URLs while retaining formatting', async () => {
  const sanitizer = require('sanitize-html')
  const source = read('lib/product-content.js').replace("import sanitizeHtml from 'sanitize-html'", 'const sanitizeHtml = globalThis.__testSanitizer')
  globalThis.__testSanitizer = sanitizer
  try {
    const { safeProductHtml } = await load(source)
    const html = safeProductHtml('<script>alert(1)</script><img src=x onerror=alert(1)><strong>Silk</strong>\n<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>')
    assert.doesNotMatch(html, /script|onerror|<img|javascript:/)
    assert.match(html, /<strong>Silk<\/strong>/)
    assert.match(html, /href="https:\/\/example.com"/)
    assert.equal(safeProductHtml(null), '')
  } finally { delete globalThis.__testSanitizer }
})

test('confirmation page never invents an order or clears the basket on entry', () => {
  const source = read('app/order-confirmed/page.jsx')
  assert.doesNotMatch(source, /OSR-2026-0001/)
  assert.match(source, /if \(status !== 'confirmed'\) return/)
  assert.match(source, /if \(!stripeMatch\) return/)
  assert.match(source, /api\/order-status/)
  assert.match(source, /status !== 'confirmed'/)
})

test('reset form handles session fallback and cleans up its listener', () => {
  const source = read('app/account/reset-password/page.jsx')
  assert.match(source, /getSession\(/)
  assert.match(source, /exchangeCodeForSession\(/)
  assert.match(source, /subscription.unsubscribe\(/)
  assert.match(source, /15000/)
})

test('status endpoint verifies Stripe binding, reports pending and never leaks customer data', async () => {
  let order = { status: 'pending', payment_method: 'stripe', payment_intent_id: 'cs_test_abcdefghijklmnopqrstuvwxyz' }
  let metadata = { orderNumber: 'OSR-TEST' }
  globalThis.__statusDb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order }) }) }) }) }
  globalThis.__statusStripe = class { checkout = { sessions: { retrieve: async () => ({ id: 'cs_test_abcdefghijklmnopqrstuvwxyz', payment_intent: 'pi_paid', metadata }) } } }
  const source = read('app/api/order-status/route.js')
    .replace("import { supabaseAdmin } from '@osr/core/lib/supabase'", 'const supabaseAdmin = globalThis.__statusDb')
    .replace("import { verifyPaymentProof } from '@/lib/payment-proof'", 'const verifyPaymentProof = () => false')
    .replace("import Stripe from 'stripe'", 'const Stripe = globalThis.__statusStripe')
  try {
    const { GET } = await load(source)
    const req = new Request('https://example.com/api/order-status?order=OSR-TEST&session_id=cs_test_abcdefghijklmnopqrstuvwxyz')
    assert.deepEqual(await (await GET(req)).json(), { status: 'pending' })
    order = { ...order, status: 'paid', payment_intent_id: 'pi_paid' }
    const paid = await GET(req)
    assert.equal(paid.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await paid.json(), { status: 'confirmed' })
    metadata = { orderNumber: 'OSR-OTHER' }
    assert.equal((await GET(req)).status, 404)
    assert.equal((await GET(new Request('https://example.com/api/order-status?order=OSR-TEST'))).status, 400)
  } finally { delete globalThis.__statusDb; delete globalThis.__statusStripe }
})
