const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')
const compile = (source, bindings, result) => new Function(...Object.keys(bindings),
  source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `; return ${result}`,
)(...Object.values(bindings))
const variants = compile(read('lib/product-variants.js'), {}, '({skuAttributes,matchSku,merchantVariantAttributes})')
const pricing = compile(read('lib/pricing.js'), {}, '({gbpToPence})')
const selection = compile(read('lib/product-selection.js'), variants, '({productOptionGroups,selectionIsComplete,selectedOptionRows})')
const product = { id: 'product-1', name: 'Fine silk ribbon', collection: 'fine-silk-ribbons', attribute_config: [
  { name: 'COLOR', options: [{ value: 'Blue' }, { value: 'Red' }] },
  { name: 'WIDTH', options: ['4mm', '7mm'] },
] }
const sku = { id: 'sku-1', sku_code: 'RIBBON-BLUE-7', price_gbp: '5.90', stock_qty: 10, attributes: { COLOR: 'Blue', WIDTH: '7mm' } }

test('selection summary uses actual custom SKU attributes and hides unknown default labels', () => {
  assert.deepEqual(selection.selectedOptionRows(product, sku), [
    { label: 'Colour', value: 'Blue' }, { label: 'Width', value: '7mm' },
  ])
  assert.deepEqual(selection.selectedOptionRows({}, { colour: '默认', width_mm: 4, length_m: 10 }), [
    { label: 'Width', value: '4mm' }, { label: 'Length', value: '10m' },
  ])
  assert.deepEqual(selection.selectedOptionRows(product, null), [])
})

test('cleared or invalid dropdowns are incomplete even when a partial match still finds a SKU', () => {
  const groups = selection.productOptionGroups(product, [sku])
  const attrs = { COLOR: 'Blue', WIDTH: '' }
  assert.equal(variants.matchSku(product, [sku], attrs, sku), sku)
  assert.equal(selection.selectionIsComplete(groups, attrs), false)
  assert.equal(selection.selectionIsComplete(groups, { COLOR: 'Blue', WIDTH: '99mm' }), false)
  assert.equal(selection.selectionIsComplete(groups, sku.attributes), true)
})

test('legacy options require only the selectable groups and retain known length and width', () => {
  const old = [{ colour: 'Blue', width_mm: 4, length_m: 10 }, { colour: 'Blue', width_mm: 7, length_m: 10 }]
  const groups = selection.productOptionGroups({}, old)
  assert.deepEqual(groups, [{ name: 'Width', options: ['4mm', '7mm'] }])
  assert.equal(selection.selectionIsComplete(groups, { Width: '7mm' }), true)
  assert.equal(selection.selectionIsComplete(groups, {}), false)
  assert.equal(selection.selectionIsComplete([], {}), true)
})

function analytics({ consent = true, ready = true, pathname = '/collections/fine-silk-ribbons/ribbon', origin = 'https://onesilkribbon.com' } = {}) {
  const sent = []
  const state = { consent }
  const window = { location: { origin, pathname, search: '?email=PRIVATE&proof=SECRET', hash: '#TOKEN' } }
  if (ready) window.gtag = (...args) => sent.push(args)
  const methods = compile(read('lib/storefront-analytics.js'), {
    ...variants, ...pricing, window, hasConsented: () => state.consent,
  }, '({trackProductEvent,flushProductEvents,isPrivateAnalyticsPath,GA_ID})')
  return { ...methods, state, window, sent }
}

test('product events use the actual SKU and quantity, exact GBP value and an allowlist of public fields', () => {
  const h = analytics()
  assert.equal(h.trackProductEvent('add_to_cart', { ...product, customer_email: 'PRIVATE', description: 'SECRET' }, { ...sku, token: 'TOKEN' }, 3), true)
  assert.equal(h.sent.length, 1)
  const [command, event, data] = h.sent[0]
  assert.equal(command, 'event')
  assert.equal(event, 'add_to_cart')
  assert.equal(data.currency, 'GBP')
  assert.equal(data.value, 17.7)
  assert.equal(data.items[0].price, 5.9)
  assert.equal(data.items[0].quantity, 3)
  assert.equal(data.items[0].item_id, sku.sku_code)
  assert.equal(data.items[0].item_variant, 'Blue, 7mm')
  assert.equal(data.page_location, 'https://onesilkribbon.com/collections/fine-silk-ribbons/ribbon')
  assert.equal(data.page_referrer, '')
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE|SECRET|TOKEN|customer_email|description|token|\?email/)
})

test('no consent, denied storage, previews and private pages cannot create ecommerce events', () => {
  const denied = analytics({ consent: false })
  assert.equal(denied.trackProductEvent('view_item', product, sku), false)
  denied.state.consent = true
  denied.flushProductEvents()
  assert.deepEqual(denied.sent, [], 'events from before consent are not replayed')
  for (const pathname of ['/checkout', '/checkout/payment', '/account/orders/1', '/auth/confirm', '/order-confirmed', '/track-order', '/admin', '/login', '/api/settings', '/collections']) {
    const h = analytics({ pathname })
    assert.equal(h.trackProductEvent('view_item', product, sku), false, pathname)
    assert.deepEqual(h.sent, [])
  }
  assert.equal(analytics({ origin: 'http://localhost:3100' }).trackProductEvent('view_item', product, sku), false)
  const blocked = compile(read('lib/storefront-analytics.js'), { ...variants, ...pricing,
    window: {}, hasConsented: () => { throw Error('Storage denied') },
  }, 'trackProductEvent')
  assert.equal(blocked('view_item', product, sku), false)
})

test('only consented events wait for the tag and they are discarded on withdrawal or private navigation', () => {
  const h = analytics({ ready: false })
  assert.equal(h.trackProductEvent('view_item', product, sku), true)
  h.window.gtag = (...args) => h.sent.push(args)
  h.flushProductEvents()
  assert.equal(h.sent.length, 1)
  h.flushProductEvents()
  assert.equal(h.sent.length, 1)
  for (const mode of ['withdraw', 'private', 'another-product']) {
    const queued = analytics({ ready: false })
    queued.trackProductEvent('add_to_cart', product, sku)
    if (mode === 'withdraw') queued.state.consent = false
    else queued.window.location.pathname = mode === 'private' ? '/checkout' : '/collections/fine-silk-ribbons/another'
    queued.flushProductEvents()
    queued.state.consent = true
    queued.window.location.pathname = '/collections/fine-silk-ribbons/ribbon'
    queued.window.gtag = (...args) => queued.sent.push(args)
    queued.flushProductEvents()
    assert.deepEqual(queued.sent, [], mode)
  }
})

test('ecommerce queue is bounded and invalid values, unavailable SKUs and unknown events are ignored', () => {
  const h = analytics({ ready: false })
  for (let i = 0; i < 30; i++) h.trackProductEvent('add_to_cart', product, sku)
  h.window.gtag = (...args) => h.sent.push(args)
  h.flushProductEvents()
  assert.equal(h.sent.length, 20)
  const invalid = analytics()
  for (const quantity of [0, -1, 1.5, '2', Infinity, Number.MAX_SAFE_INTEGER]) assert.equal(invalid.trackProductEvent('add_to_cart', product, sku, quantity), false)
  for (const price_gbp of ['bad', -1, 0, null]) assert.equal(invalid.trackProductEvent('view_item', product, { ...sku, price_gbp }), false)
  assert.equal(invalid.trackProductEvent('purchase', product, sku), false)
  assert.equal(invalid.trackProductEvent('view_item', product, { ...sku, is_active: false }), false)
  assert.deepEqual(invalid.sent, [])
})

test('a disabled or failing analytics tag never throws into shopping handlers', () => {
  const h = analytics()
  h.window[`ga-disable-${h.GA_ID}`] = true
  h.trackProductEvent('view_item', product, sku)
  assert.deepEqual(h.sent, [])
  h.window[`ga-disable-${h.GA_ID}`] = false
  h.window.gtag = () => { throw Error('Blocked tag') }
  assert.doesNotThrow(() => h.flushProductEvents())
  assert.doesNotThrow(() => h.trackProductEvent('add_to_cart', product, sku))
})

test('product view is recorded once per mount after consent, without re-counting quantity or option changes', () => {
  const listeners = new Map(), effects = [], viewed = { current: new Set() }
  let accepted = false
  const recorded = []
  const useProductAnalytics = compile(read('lib/use-product-analytics.js'), {
    useRef: () => viewed, useEffect: fn => effects.push(fn), CONSENT_EVENT: 'consent',
    trackProductEvent: (...args) => { if (!accepted) return false; recorded.push(args); return true },
    window: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
    },
  }, 'useProductAnalytics')
  useProductAnalytics(product, sku)
  const cleanup = effects[0]()
  assert.equal(recorded.length, 0)
  accepted = true
  listeners.get('consent')()
  listeners.get('storage')()
  assert.equal(recorded.length, 1)
  cleanup()
  useProductAnalytics(product, { ...sku, id: 'another-option' })
  const nextCleanup = effects[1]()
  assert.equal(recorded.length, 1)
  nextCleanup()
  assert.equal(listeners.size, 0)
})

function purchaseHandlers({ canPurchase = true, quantity = 2, buyingNow = false } = {}) {
  const calls = []
  const source = read('app/collections/[slug]/[productSlug]/ProductClient.jsx')
  const block = source.slice(source.indexOf('  const buildCartItem'), source.indexOf('  const navImg'))
  const methods = compile(block, {
    canPurchase, qty: quantity, buyingNow, selectedSku: sku, product, selectedAttrs: sku.attributes,
    safe: String, safeNum: Number, images: ['ribbon.jpg'],
    addItem: item => calls.push(['basket', item]), trackProductEvent: (...args) => calls.push(['analytics', ...args]),
    setAdded() {}, setBuyingNow() {}, clearTimeout() {}, setTimeout() {}, addedTimer: { current: null },
    router: { push: url => calls.push(['navigate', url]) },
  }, '({handleAdd,handleBuyNow})')
  return { ...methods, calls }
}

test('basket events follow successful additions and use the selected SKU and actual added quantity', () => {
  const h = purchaseHandlers()
  h.handleAdd()
  assert.deepEqual(h.calls.map(call => call[0]), ['basket', 'analytics'])
  assert.equal(h.calls[0][1].skuId, sku.id)
  assert.equal(h.calls[0][1].qty, 2)
  assert.equal(h.calls[1][1], 'add_to_cart')
  assert.equal(h.calls[1][3], sku)
  assert.equal(h.calls[1][4], 2)
  const buy = purchaseHandlers()
  buy.handleBuyNow()
  assert.deepEqual(buy.calls.map(call => call[0]), ['basket', 'analytics', 'navigate'])
  assert.equal(buy.calls[2][1], '/checkout')
})

test('incomplete selections, invalid quantities and an already-running Buy Now cannot add or report items', () => {
  for (const options of [{ canPurchase: false }, { quantity: 0 }, { quantity: 1.5 }]) {
    const h = purchaseHandlers(options)
    h.handleAdd(); h.handleBuyNow()
    assert.deepEqual(h.calls, [])
  }
  const running = purchaseHandlers({ buyingNow: true })
  running.handleBuyNow()
  assert.deepEqual(running.calls, [])
})
