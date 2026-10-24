const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function load(file, bindings, exported) {
  return new Function(...Object.keys(bindings), read(file).replace(/^import .*$/gm, '').replace(/^export /gm, '') + `;return ${exported}`)(...Object.values(bindings))
}
const parseStockQuantity = load('packages/core/admin/lib/stock-quantity.js', {}, 'parseStockQuantity')
const errorResponse = () => Response.json({ error: 'Please retry' }, { status: 500 })
function database(respond) {
  const calls = []
  return { calls, from(table) {
    const call = { table, operation: 'read', filters: [] }
    calls.push(call)
    const q = {
      select(columns, options) { call.columns = columns; call.options = options; return q },
      eq(key, value) { call.filters.push(['eq', key, value]); return q },
      is(key, value) { call.filters.push(['is', key, value]); return q },
      in(key, value) { call.filters.push(['in', key, value]); return q },
      update(row) { call.operation = 'update'; call.row = row; return q },
      insert(row) { call.operation = 'insert'; call.row = row; return q },
      delete() { call.operation = 'delete'; return q },
      order() { return q }, maybeSingle() { return q }, single() { return q },
      then(resolve, reject) { return Promise.resolve().then(() => respond(call)).then(resolve, reject) },
    }
    return q
  } }
}
function stock(respond, authorized = true) {
  const db = database(respond)
  const PATCH = load('packages/core/admin/api/stock.js', { supabaseAdmin: db,
    verifyAdmin: async () => authorized, errorResponse, parseStockQuantity }, 'PATCH')
  return { db, patch: body => PATCH({ json: async () => body }) }
}
const product = { id: 'product-1', slug: 'ribbon', name: 'Silk ribbon', collection: 'silk' }
const sku = { id: 'sku-1', price_gbp: '9.00', stock_qty: 10, loaded_stock_qty: 10 }
function products(respond) {
  const db = database(respond)
  const POST = load('packages/core/admin/api/products.js', { supabase: db,
    verifyAdmin: async () => true, errorResponse, parseStockQuantity, recordSlugChange: async () => {} }, 'POST')
  return { db, post: body => POST({ json: async () => body }) }
}
const update = (skus = [sku], deletedSkuIds = []) => ({ action: 'update', product, skus, deletedSkuIds })
const catalogReply = call => ({ data: call.operation === 'read'
  ? call.table === 'products' ? { slug: product.slug } : [{ id: 'sku-1' }, { id: 'newer-sku' }]
  : { id: 'sku-1' } })

test('stock parser rejects values that previously became zero or truncated integers', () => {
  for (const value of ['', ' ', null, undefined, true, false, [], {}, '1.5', 1.5, '1abc', 'Infinity', Infinity, NaN, -1, 2147483648]) {
    assert.equal(parseStockQuantity(value), null)
  }
  assert.equal(parseStockQuantity(' 12 '), 12)
  assert.equal(parseStockQuantity(0), 0)
  assert.equal(parseStockQuantity(2147483647), 2147483647)
  // Legacy negative stock can be compared and repaired, never newly written.
  assert.equal(parseStockQuantity(-3, { allowNegative: true }), -3)
})

test('invalid later stock entries stop the whole batch before any writes', async () => {
  for (const invalid of [null, {}, { id: 'two', stock_qty: 3 }, { id: 'two', stock_qty: '', expected: 1 },
    { id: 'two', stock_qty: 1.2, expected: 1 }, { id: 'two', stock_qty: 3, expected: false },
    { id: 'one', stock_qty: 3, expected: 1 }]) {
    const h = stock(() => { throw Error('Should not write') })
    const response = await h.patch({ updates: [{ id: 'one', stock_qty: 2, expected: 1 }, invalid] })
    assert.equal(response.status, 400)
    assert.equal(h.db.calls.length, 0)
  }
})

test('stock updates require and compare numeric or null baselines', async () => {
  for (const expected of [10, null, -2]) {
    const h = stock(() => ({ data: [{ id: 'sku-1', stock_qty: 12 }] }))
    const response = await h.patch({ updates: [{ id: 'sku-1', stock_qty: '12', expected }] })
    assert.equal(response.status, 200)
    const result = (await response.json()).results[0]
    assert.equal(result.ok, true)
    assert.ok(h.db.calls[0].filters.some(([kind, key, value]) => kind === (expected === null ? 'is' : 'eq') && key === 'stock_qty' && value === expected))
  }
})

test('intervening checkout preserves stock and lookup failures are not called missing SKUs', async () => {
  for (const failedRead of [false, true]) {
    const h = stock(call => call.operation === 'update' ? { data: [] }
      : failedRead ? { error: true } : { data: { stock_qty: 8 } })
    const response = await h.patch({ updates: [{ id: 'sku-1', stock_qty: 15, expected: 10 }] })
    const result = (await response.json()).results[0]
    assert.equal(result.ok, false)
    if (failedRead) assert.match(result.error, /核对/)
    else { assert.equal(result.conflict, true); assert.equal(result.current, 8) }
  }
  const denied = stock(() => { throw Error('Not authorized') }, false)
  assert.equal((await denied.patch({ updates: [] })).status, 401)
  assert.equal(denied.db.calls.length, 0)
})

test('saving an old product editor cannot remove a newly created omitted SKU', async () => {
  const h = products(catalogReply)
  assert.equal((await h.post(update())).status, 200)
  assert.ok(!h.db.calls.some(call => call.operation === 'delete'))
  assert.ok(!h.db.calls.some(call => call.table === 'order_items'))
  const writes = h.db.calls.filter(call => call.table === 'product_skus' && call.operation === 'update')
  assert.equal(writes.length, 1)
  assert.ok(writes[0].filters.some(([, key, value]) => key === 'id' && value === 'sku-1'))
})

test('only explicitly removed SKUs are deleted or deactivated with history retained', async () => {
  for (const historical of [false, true]) {
    const h = products(call => call.table === 'order_items' ? { data: historical ? [{ sku_id: 'newer-sku' }] : [] } : catalogReply(call))
    assert.equal((await h.post(update([sku], ['newer-sku']))).status, 200)
    const removal = h.db.calls.find(call => call.table === 'product_skus' &&
      (call.operation === 'delete' || call.row?.is_active === false))
    assert.equal(removal.operation, historical ? 'update' : 'delete')
    assert.deepEqual(removal.filters.find(([kind]) => kind === 'in')[2], ['newer-sku'])
  }
})

test('older clients without loaded stock must refresh before saving, without false success', async () => {
  const h = products(catalogReply)
  const { loaded_stock_qty, ...oldSku } = sku
  assert.equal((await h.post(update([{ ...oldSku, stock_qty: 100 }]))).status, 409)
  assert.equal(h.db.calls.length, 0)
})

test('explicit edits against null inventory compare SQL null rather than zero', async () => {
  const h = products(catalogReply)
  assert.equal((await h.post(update([{ ...sku, loaded_stock_qty: null, stock_qty: 5 }]))).status, 200)
  const write = h.db.calls.find(call => call.table === 'product_skus' && call.operation === 'update')
  assert.ok(write.filters.some(([kind, key, value]) => kind === 'is' && key === 'stock_qty' && value === null))
})

test('malformed product batches and invalid prices or quantities cannot partially save', async () => {
  for (const body of [null, update(null), update([sku, sku]), update([sku], ['sku-1']),
    update([{ ...sku, stock_qty: '2.5' }]), update([{ ...sku, price_gbp: '9oops' }]),
    update([{ ...sku, price_gbp: '' }]), update([{ ...sku, loaded_stock_qty: false }]),
    update([sku, { ...sku, id: 'sku-2', price_gbp: -1 }])]) {
    const h = products(() => { throw Error('Validation should stop all database calls') })
    assert.equal((await h.post(body)).status, 400)
    assert.equal(h.db.calls.length, 0)
  }
})

const helpers = load('packages/core/admin/api/_helpers.js', {}, '({fetchAll,readSettings,dayKey})')
test('failed settings queries cannot be returned as empty settings', async () => {
  await assert.rejects(helpers.readSettings(database(() => ({ error: Error('offline') }))), /offline/)
  await assert.rejects(helpers.readSettings(database(() => ({ data: null }))), /Invalid settings/)
  assert.deepEqual(await helpers.readSettings(database(() => ({ data: [] }))), {})
})

test('pagination exhaustion and malformed pages are errors, never successful partial catalogs', async () => {
  let calls = 0
  const truncated = await helpers.fetchAll(() => ({ range: async () => ({ data: [{ id: ++calls }] }) }), { maxPages: 2 })
  assert.equal(truncated.data.length, 2)
  assert.ok(truncated.error)
  const complete = await helpers.fetchAll(() => ({ range: async start => ({ data: start === 0 ? [{ id: 1 }] : [] }) }))
  assert.equal(complete.error, null)
  assert.equal(complete.data.length, 1)
  const invalid = await helpers.fetchAll(() => ({ range: async () => ({ data: null }) }))
  assert.ok(invalid.error)
})

test('dashboard rejects partial SKU/product/item queries and keeps optional email-log fallback', async () => {
  for (const failed of ['orders', 'product_skus', 'products', 'order_items', null]) {
    // Identify each source query, including the separately optional email log.
    const db = { from(table) { const q = { table, select: () => q, order: () => q, eq: () => q, gte: () => q, then: resolve => resolve({ error: true }) }; return q } }
    const run = load('packages/core/admin/api/dashboard.js', { supabaseAdmin: db, verifyAdmin: async () => true,
      errorResponse, REVENUE_STATUSES: ['paid', 'shipped', 'delivered'], readSettings: async () => ({}), dayKey: helpers.dayKey,
      fetchAll: async makeQuery => ({ data: [], error: makeQuery().table === failed ? Error('offline') : null }),
    }, 'GET')
    const response = await run()
    assert.equal(response.status, failed ? 500 : 200)
    if (!failed) assert.equal((await response.json()).todo.failedEmails, null)
  }
})

test('settings loading preserves individual zero/missing values and supports recoverable failure', async () => {
  const source = read('packages/core/admin/pages/settings/SettingsPage.jsx')
  const prefix = source.split('function StoreSettings() {')[1].split('  const dirty')[0]
  const render = api => {
    const states = [], effects = []
    new Function('useToast', 'useState', 'useRef', 'useEffect', 'api', 'SHIPPING_DEFAULTS',
      `return function Component() {${prefix}}`)(
      () => ({}), initial => { const index = states.length; states.push(initial); return [initial, next => { states[index] = next }] },
      value => ({ current: value }), effect => effects.push(effect), api,
      { shipping_rate: '3.95', free_shipping_threshold: '45.00', free_shipping_enabled: 'true' },
    )()
    return { states, effects }
  }
  const h = render(async () => ({ settings: { free_shipping_threshold: '0', free_shipping_enabled: 'false' } }))
  h.effects[0](); await new Promise(done => setImmediate(done))
  assert.equal(h.states[0].shipping_rate, '3.95')
  assert.equal(h.states[0].free_shipping_threshold, '0')
  assert.equal(h.states[0].free_shipping_enabled, 'false')
  const failed = render(async () => { throw Error('offline') })
  failed.effects[0](); await new Promise(done => setImmediate(done))
  assert.equal(failed.states[0], null)
  assert.match(failed.states[2], /offline/)
  let resolve
  const cancelled = render(() => new Promise(done => { resolve = done }))
  cancelled.effects[0]()()
  resolve({ settings: { shipping_rate: '0' } })
  await new Promise(done => setImmediate(done))
  assert.equal(cancelled.states[0], null)
})

test('switching product routes cancels stale reads and keys editor state by product identity', async () => {
  const source = read('packages/core/admin/pages/products/ProductEditorPage.jsx')
  const effects = [], states = [], callbacks = []
  let stateIndex = 0
  const hooks = { useRouter: () => ({}), useCallback: callback => { callbacks.push(callback); return callback },
    useEffect: callback => effects.push(callback), useState: initial => {
      const index = stateIndex++; states[index] ??= initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    } }
  let resolve
  const api = () => new Promise(done => { resolve = done })
  const prefix = source.split('export default function ProductEditorPage({ id }) {')[1].split('  if (isNew) {')[0]
  const render = new Function(...Object.keys(hooks), 'api', `return function Component(id) {${prefix}}`)(...Object.values(hooks), api)
  render('product-1')
  const cleanup = effects[0]()
  cleanup()
  resolve({ product: { id: 'product-1' }, skus: [] })
  await new Promise(done => setImmediate(done))
  assert.equal(states[0], null)
  assert.match(source, /key=\{`\$\{id\}:\$\{version\}`\}/)
  assert.match(source, /data\.product\.id !== id/)
  assert.match(source, /if \(await load\(\)\) setVersion/)
})
