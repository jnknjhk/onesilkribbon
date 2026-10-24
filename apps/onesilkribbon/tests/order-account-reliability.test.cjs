const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function load(file, bindings, exported) {
  const source = read(file).replace(/^import .*$/gm, '').replace(/^export /gm, '')
  return new Function(...Object.keys(bindings), source + `;return ${exported}`)(...Object.values(bindings))
}
function database(respond) {
  const calls = []
  return { calls, from(table) {
    const call = { table, operation: 'read', filters: [] }
    calls.push(call)
    const query = {
      select(columns, options) { call.columns = columns; call.options = options; return query },
      eq(key, value) { call.filters.push([key, value]); return query },
      is(key, value) { call.filters.push([key, value]); return query },
      in(key, value) { call.filters.push([key, value]); return query },
      order() { return query }, range() { return query }, or() { return query },
      update(row) { call.operation = 'update'; call.row = row; return query },
      insert(row) { call.operation = 'insert'; call.row = row; return query },
      upsert(row, options) { call.operation = 'upsert'; call.row = row; call.upsertOptions = options; return query },
      maybeSingle() { return query }, single() { return query },
      then(resolve, reject) { return Promise.resolve().then(() => respond(call)).then(resolve, reject) },
    }
    return query
  } }
}
const safeError = () => Response.json({ error: 'Operation failed safely' }, { status: 500 })
const status = load('packages/core/admin/lib/status.js', {}, '({ORDER_TABS,DEFAULT_ORDER_TAB,tabStatuses,CAN,statusLabel})')
const order = { id: 'order-1', order_number: 'OSR-TEST', status: 'paid', customer_email: 'test@example.test',
  tracking_number: null, tracking_carrier: null, tracking_url: null, shipped_at: null }
const shipment = { orderNumber: order.order_number, trackingNumber: 'TEST123', carrier: 'Royal Mail', trackingUrl: 'https://www.royalmail.com/track' }
const shipFile = 'apps/onesilkribbon/app/api/admin/ship/route.js'
const ordersFile = 'packages/core/admin/api/orders.js'
const customerOrdersFile = 'apps/onesilkribbon/app/api/user/orders/route.js'
function shipping(respond, authorized = true, mailFails = false) {
  const db = database(respond), sent = []
  const POST = load(shipFile, { supabaseAdmin: db, verifyAdmin: async () => authorized,
    NextResponse: Response, errorResponse: safeError, ...status,
    sendShippingNotification: async message => { sent.push(message); if (mailFails) throw Error('Mail unavailable') },
  }, 'POST')
  return { db, sent, post: body => POST({ json: async () => body }) }
}
function adminOrders(respond) {
  const db = database(respond)
  const routes = load(ordersFile, { supabaseAdmin: db, verifyAdmin: async () => true,
    errorResponse: safeError, cleanSearch: text => text || '', ...status }, '({GET,PATCH})')
  return { db, get: query => routes.GET({ url: `https://example.test/api/admin/orders?${query}` }),
    patch: body => routes.PATCH({ json: async () => body }) }
}

test('shipment authorization and input validation stop before database writes or mail', async () => {
  const denied = shipping(() => { throw Error('No access expected') }, false)
  assert.equal((await denied.post(shipment)).status, 401)
  assert.equal(denied.db.calls.length, 0)
  const h = shipping(() => { throw Error('Invalid input reached database') })
  for (const body of [null, [], {}, { ...shipment, carrier: '' }, { ...shipment, trackingNumber: 12 },
    { ...shipment, trackingUrl: 'javascript:alert(1)' }, { ...shipment, trackingUrl: 'https://user:pass@example.test/' },
    { ...shipment, trackingUrl: 'https://example.test/\\evil' }, { ...shipment, trackingUrl: {} }]) {
    assert.equal((await h.post(body)).status, 400)
  }
  assert.equal(h.db.calls.length, 0)
  assert.equal(h.sent.length, 0)
})

test('shipment read/write failures cannot record history or notify customers', async () => {
  for (const phase of ['read', 'update']) {
    const h = shipping(call => call.operation === phase ? { error: true } : { data: order })
    assert.equal((await h.post(shipment)).status, 500)
    assert.equal(h.sent.length, 0)
    assert.ok(!h.db.calls.some(call => call.table === 'tracking_events'))
  }
  for (const state of ['pending', 'cancelled', 'refunded', 'delivered']) {
    const h = shipping(() => ({ data: { ...order, status: state } }))
    assert.equal((await h.post(shipment)).status, 409)
    assert.ok(h.db.calls.every(call => call.operation === 'read'))
  }
})

test('a concurrent refund or tracking change blocks shipping and sends no email', async () => {
  const h = shipping(call => call.operation === 'update' ? { data: null } : { data: order })
  assert.equal((await h.post(shipment)).status, 409)
  assert.equal(h.sent.length, 0)
  const update = h.db.calls.find(call => call.operation === 'update')
  assert.ok(update.filters.some(([key, value]) => key === 'status' && value === 'paid'))
  for (const key of ['tracking_number', 'tracking_carrier', 'tracking_url', 'shipped_at']) {
    assert.ok(update.filters.some(([field, value]) => field === key && value === null))
  }
})

test('simultaneous shipping requests only commit and notify once', async () => {
  let stored = { ...order }
  const h = shipping(call => {
    if (call.table === 'orders' && call.operation === 'read') return { data: { ...stored } }
    if (call.table === 'orders' && call.operation === 'update') {
      if (!call.filters.every(([key, value]) => (stored[key] ?? null) === value)) return { data: null }
      stored = { ...stored, ...call.row }
      return { data: { ...stored } }
    }
    return {}
  })
  const responses = await Promise.all([h.post(shipment), h.post(shipment)])
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
  assert.equal(h.sent.length, 1)
  assert.equal(h.db.calls.filter(call => call.table === 'tracking_events').length, 1)
})

test('editing a shipment preserves original dispatch time and uses saved data in mail', async () => {
  const firstDispatch = '2026-01-02T10:00:00.000Z'
  const existing = { ...order, status: 'shipped', shipped_at: firstDispatch }
  const h = shipping(call => ({ data: call.operation === 'update' ? { ...existing, ...call.row } : existing }))
  const response = await h.post({ ...shipment, trackingNumber: ' NEW123 ', carrier: ' Royal Mail ' })
  assert.equal(response.status, 200)
  assert.equal(h.sent[0].order.shipped_at, firstDispatch)
  assert.equal(h.sent[0].trackingNumber, 'NEW123')
  const history = h.db.calls.find(call => call.table === 'tracking_events')
  assert.notEqual(history.row.event_time, firstDispatch)
})

test('history failure reports partial success without inviting repeat shipment', async () => {
  for (const throws of [false, true]) {
    const h = shipping(call => {
      if (call.table === 'tracking_events') { if (throws) throw Error('offline'); return { error: true } }
      return { data: call.operation === 'update' ? { ...order, ...call.row } : order }
    })
    const response = await h.post(shipment)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).historySaved, false)
    assert.equal(h.sent.length, 1)
  }
})

test('mail failure retains successful shipping and missing orders cannot trigger writes', async () => {
  const h = shipping(call => ({ data: call.operation === 'update' ? { ...order, ...call.row } : order }), true, true)
  const response = await h.post(shipment)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, emailSent: false, historySaved: true })
  const missing = shipping(() => ({ data: null }))
  assert.equal((await missing.post(shipment)).status, 404)
  assert.equal(missing.sent.length, 0)
  assert.ok(missing.db.calls.every(call => call.operation === 'read'))
})

test('delivery cannot overwrite a refund or write a false Delivered event', async () => {
  const h = adminOrders(call => ({ data: call.operation === 'update' ? null : { ...order, status: 'shipped' } }))
  assert.equal((await h.patch({ id: order.id, action: 'deliver' })).status, 409)
  const update = h.db.calls.find(call => call.operation === 'update')
  assert.ok(update.filters.some(([key, value]) => key === 'status' && value === 'shipped'))
  assert.ok(!h.db.calls.some(call => call.table === 'tracking_events'))
})

test('cancel conflict is explicit and delivery history failure preserves saved status', async () => {
  const cancelled = adminOrders(call => ({ data: call.operation === 'update' ? null : { ...order, status: 'pending' } }))
  assert.equal((await cancelled.patch({ id: order.id, action: 'cancel' })).status, 409)
  const delivered = adminOrders(call => call.table === 'tracking_events' ? { error: true }
    : { data: call.operation === 'update' ? { ...order, status: 'delivered' } : { ...order, status: 'shipped' } })
  const response = await delivered.patch({ id: order.id, action: 'deliver' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.order.status, 'delivered')
  assert.equal(body.historySaved, false)
})

test('admin order detail and packing slips reject failed item/tracking reads', async () => {
  for (const table of ['order_items', 'tracking_events']) {
    const h = adminOrders(call => call.table === table ? { error: true } : { data: order })
    assert.equal((await h.get('number=OSR-TEST')).status, 500)
  }
  const print = adminOrders(call => call.table === 'order_items' ? { error: true } : { data: [order] })
  assert.equal((await print.get('numbers=OSR-TEST')).status, 500)
  const thrown = adminOrders(() => { throw Error('network unavailable') })
  assert.equal((await thrown.get('number=OSR-TEST')).status, 500)
})

test('order list counts and summaries never turn database failures into zero items', async () => {
  for (const result of [{ error: true }, { count: null }]) {
    const h = adminOrders(() => result)
    assert.equal((await h.get('countsOnly=1')).status, 500)
  }
  const h = adminOrders(call => call.table === 'order_items' ? { error: true }
    : call.options?.head ? { count: 1 } : { data: [order], count: 1 })
  assert.equal((await h.get('tab=all')).status, 500)
})

test('customer order responses retain ownership filtering and omit internal fields', async () => {
  const stored = { ...order, user_id: 'customer-1', notes: 'PRIVATE STAFF NOTE', payment_intent_id: 'pi_private' }
  const db = database(call => ({ data: call.table === 'orders'
    ? Object.fromEntries(call.columns.split(',').map(key => [key, stored[key]])) : [] }))
  const GET = load(customerOrdersFile, { supabaseAdmin: db, getUser: async () => ({ id: 'customer-1' }), errorResponse: safeError }, 'GET')
  const response = await GET({ url: 'https://example.test/api/user/orders?id=order-1' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json()
  assert.equal(body.order.order_number, order.order_number)
  assert.equal(body.order.notes, undefined)
  assert.equal(body.order.payment_intent_id, undefined)
  assert.ok(db.calls[0].filters.some(([key, value]) => key === 'user_id' && value === 'customer-1'))
  assert.ok(db.calls.every(call => call.columns !== '*'))
})

test('customer order failures are distinct from a missing order and never yield partial data', async () => {
  for (const table of ['orders', 'order_items', 'tracking_events']) {
    const db = database(call => call.table === table ? { error: true } : { data: order })
    const GET = load(customerOrdersFile, { supabaseAdmin: db, getUser: async () => ({ id: 'customer-1' }), errorResponse: safeError }, 'GET')
    assert.equal((await GET({ url: 'https://example.test/api/user/orders?id=order-1' })).status, 500)
  }
  const db = database(() => ({ data: null }))
  const GET = load(customerOrdersFile, { supabaseAdmin: db, getUser: async () => ({ id: 'customer-1' }), errorResponse: safeError }, 'GET')
  assert.equal((await GET({ url: 'https://example.test/api/user/orders?id=not-owned' })).status, 404)
})

test('anonymous customer order requests never query private tables', async () => {
  const db = database(() => { throw Error('Unauthorized query') })
  const GET = load(customerOrdersFile, { supabaseAdmin: db, getUser: async () => null, errorResponse: safeError }, 'GET')
  assert.equal((await GET({ url: 'https://example.test/api/user/orders?id=order-1' })).status, 401)
  assert.equal(db.calls.length, 0)
})

test('login profile creation cannot overwrite customer edits, even with simultaneous callbacks', async () => {
  let stored = { id: 'customer-1', first_name: 'Customer chosen', last_name: 'Surname', phone: '123' }
  const db = database(call => {
    if (call.operation === 'upsert') {
      if (stored && call.upsertOptions.ignoreDuplicates) return { data: null }
      stored = { ...call.row }
    }
    return { data: { ...stored } }
  })
  const ensure = load('apps/onesilkribbon/lib/user-records.js', { supabaseAdmin: db }, 'ensureUserProfile')
  const user = { id: 'customer-1', email: 'test@example.test', user_metadata: { full_name: 'Google Old Name' } }
  const results = await Promise.all([ensure(user), ensure(user)])
  assert.ok(results.every(profile => profile.first_name === 'Customer chosen'))
  assert.equal(stored.phone, '123')
  stored = null
  const created = await ensure(user)
  assert.equal(created.first_name, 'Google')
  assert.equal(created.last_name, 'Old Name')
})

function customerPageHarness(fetcher) {
  const states = [], effects = []
  const source = read('apps/onesilkribbon/app/account/orders/[id]/page.jsx')
    .split('export default function OrderDetailPage() {')[1].split('  const fmtDate')[0]
  const run = new Function('useParams', 'useAuth', 'useState', 'useEffect', 'fetch',
    `return function Component() {${source}}`)(
    () => ({ id: 'order-1' }), () => ({ user: { id: 'customer-1' } }),
    initial => { const index = states.length; states.push(initial); return [initial, next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] },
    effect => effects.push(effect), fetcher,
  )
  run()
  return { states, effect: effects[0] }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

test('customer order page shows recoverable failures and ignores cancelled late responses', async () => {
  const failed = customerPageHarness(async () => Response.json({ error: 'private error' }, { status: 500 }))
  failed.effect(); await flush()
  assert.equal(failed.states[3], false)
  assert.equal(failed.states[4], false)
  assert.match(failed.states[5], /try again/i)
  let resolve
  const cancelled = customerPageHarness(() => new Promise(done => { resolve = done }))
  const cleanup = cancelled.effect()
  cleanup()
  resolve(Response.json({ order, items: [], tracking: [] }))
  await flush()
  assert.equal(cancelled.states[0], null)
  assert.equal(cancelled.states[5], '')
})
