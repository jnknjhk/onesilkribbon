const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function load(file, bindings, names) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^import .*$/gm, '').replace(/export /g, '')
  return new Function(...Object.keys(bindings), source + `;return {${names}}`)(...Object.values(bindings))
}
const money = load('lib/pricing.js', {}, 'gbpToPence,penceToGBP,calculateTotals,cartSubtotalPence,couponDiscountPence')
function pricingMock(overrides = {}) {
  const rows = {
    product_skus: [{ id: 'sku', product_id: 'product', price_gbp: '1.01', stock_qty: 100, is_active: true }],
    products: [{ id: 'product', name: 'Real silk', is_active: true }],
    settings: [],
    coupons: { code: 'SAVE', discount_type: 'percentage', discount_value: '50', min_order_gbp: '0', max_uses: null, uses_count: 0 },
    ...overrides,
  }
  const supabaseAdmin = { from(table) {
    const result = () => ({ data: rows[table], error: null })
    const query = { select() { return query }, eq() { return query }, in: async () => result(), single: async () => result() }
    return query
  } }
  return load('lib/order-pricing.js', { ...money, supabaseAdmin }, 'computeAuthoritativeOrder').computeAuthoritativeOrder
}
test('currency rounds decimal ties away from zero and sums exact decimals', () => {
  assert.equal(money.gbpToPence('1.005'), 101)
  assert.equal(money.gbpToPence('-1.005'), -101)
  assert.equal(money.cartSubtotalPence([{ price: '0.105', qty: 2 }]), 21)
  assert.equal(money.couponDiscountPence({ discount_type: 'percentage', discount_value: '12.5' }, 804), 101)
  assert.equal(money.couponDiscountPence({ discount_type: 'fixed', discount_value: '5' }, 20), 0)
  assert.equal(money.penceToGBP(101), '1.01')
  for (const value of [null, true, {}, '1x', Infinity, '']) assert.throws(() => money.gbpToPence(value))
})

test('discount half-cent boundaries match PostgreSQL numeric, including fractional percentages', async () => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  try {
    for (const subtotal of [30,35,45,75,105,145,303,804,999,10001]) for (const rate of ['10','12.5','33.33','100']) {
      const result = await db.query("select least(round($1::numeric*$2::numeric/100,2),greatest(0,$1::numeric-0.30))::text amount",
        [money.penceToGBP(subtotal),rate])
      assert.equal(money.couponDiscountPence({discount_type:'percentage',discount_value:rate},subtotal),
        money.gbpToPence(result.rows[0].amount),`${subtotal} pence / ${rate}%`)
    }
  } finally { await db.close() }
})
test('gross subtotal is retained while shipping and total use net merchandise', () => {
  assert.deepEqual(money.calculateTotals('45', { shippingRate: '3.95', freeShippingThreshold: '45' }, '5'), {
    subtotal: '45.00', shipping: '3.95', total: '43.95', freeShipping: false, amountToFreeShipping: '5.00',
  })
})
test('authoritative pricing ignores forged prices and computes exact discount without writes', async () => {
  const result = await pricingMock()({ items: [{ skuId: 'sku', qty: 3, price: 999 }], couponCode: 'SAVE' })
  assert.equal(result.ok, true)
  assert.equal(result.totals.subtotal, '3.03')
  assert.equal(result.totals.discount, '1.52')
  assert.equal(result.totals.total, '5.46')
  for (const skuId of [null, {}, [], 1]) assert.equal((await pricingMock()({ items: [{ skuId, qty: 1 }] })).ok, false)
})
test('preview rejects malformed bodies and hides all coupon details on invalid codes', async () => {
  const POST = load('app/api/coupon/route.js', { computeAuthoritativeOrder: pricingMock() }, 'POST').POST
  for (const body of [null, [], { code: {} }, { code: 'SAVE', subtotal: 999 }, { code: 'SAVE', items: [] }]) {
    const response = await POST({ json: async () => body })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid promo code' })
  }
  const response = await POST({ json: async () => ({ code: 'SAVE', subtotal: 999, items: [{ skuId: 'sku', qty: 3 }] }) })
  assert.deepEqual(await response.json(), { valid: true, code: 'SAVE', discountAmount: 1.52 })
  assert.equal((await POST({ json: async () => { throw Error('bad json') } })).status, 400)
})
test('invalid, exhausted, expired and minimum coupons get identical public errors', async () => {
  for (const coupon of [null,
    { code: 'SAVE', expires_at: '2000-01-01' },
    { code: 'SAVE', max_uses: 1, uses_count: 1 },
    { code: 'SAVE', max_uses: null, min_order_gbp: 999 },
    { code: 'SAVE', max_uses: null, discount_type: 'percentage', discount_value: -10 },
  ]) {
    const POST = load('app/api/coupon/route.js', { computeAuthoritativeOrder: pricingMock({ coupons: coupon }) }, 'POST').POST
    const response = await POST({ json: async () => ({ code: 'SAVE', items: [{ skuId: 'sku', qty: 1 }] }) })
    assert.deepEqual(await response.json(), { error: 'Invalid promo code' })
  }
})
test('cart quantities merge before stock checks and malformed values fail closed', async () => {
  const run = pricingMock()
  const result = await run({ items: [{ skuId: 'sku', qty: 1 }, { skuId: 'sku', qty: 2 }] })
  assert.equal(result.lineItems.length, 1)
  assert.equal(result.totals.subtotal, '3.03')
  for (const qty of [true, null, {}, [], 0, -1, 1.5, Infinity, 'abc']) {
    assert.equal((await run({ items: [{ skuId: 'sku', qty }] })).ok, false)
  }
  assert.equal((await run({ items: [{ skuId: 'sku', qty: 60 }, { skuId: 'sku', qty: 60 }] })).ok, false)
})
function searchMock({ error = false, reject = false } = {}) {
  const calls = []
  const supabase = { from(table) {
    assert.equal(table, 'products')
    const query = { select(fields) { calls.push({ fields }); return query },
      eq(key, value) { assert.equal(key, 'is_active'); assert.equal(value, true); return query },
      ilike(column, pattern) { Object.assign(calls.at(-1), { column, pattern }); return query },
      async limit(n) { assert.equal(n, 8); if (reject) throw Error('private error')
        return { error: error ? Error('private error') : null,
          data: Array.from({ length: 8 }, (_, id) => ({ id, name: 'Silk', slug: 'silk', images: [], collection: 'ribbon', description: 'private', secret: 'hidden' })) } },
    }
    return query
  } }
  return { calls, GET: load('app/api/search/route.js', { supabase, NextResponse: Response }, 'GET').GET }
}
test('search uses three escaped filters, deduplicates and allowlists eight public results', async () => {
  const { GET, calls } = searchMock()
  const rows = await (await GET({ url: 'https://example.test/?q=' + encodeURIComponent('a\\%_,x)') })).json()
  assert.deepEqual(calls.map(c => c.column), ['name', 'description', 'collection'])
  assert.equal(calls[0].pattern, '%a\\\\\\%\\_,x)%')
  assert.equal(rows.length, 8)
  assert.deepEqual(Object.keys(rows[0]), ['id', 'name', 'slug', 'images', 'collection'])
})
test('search alias cannot broaden literal matches; long queries and database failures are safe', async () => {
  const { GET, calls } = searchMock()
  assert.deepEqual(await (await GET({ url: 'https://example.test/?q=a*b' })).json(), [])
  assert.equal(calls[0].pattern, '%a_b%')
  const empty = searchMock()
  assert.deepEqual(await (await empty.GET({ url: 'https://example.test/?q=' + 'x'.repeat(101) })).json(), [])
  assert.equal(empty.calls.length, 0)
  for (const options of [{ error: true }, { reject: true }]) {
    assert.deepEqual(await (await searchMock(options).GET({ url: 'https://example.test/?q=silk' })).json(), [])
  }
})
