const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = fs.readFileSync(path.resolve(__dirname, '../../../packages/core/admin/api/products.js'), 'utf8')

function harness(respond) {
  const calls = []
  const context = vm.createContext({
    Response, URL, Set, Date, Math,
    verifyAdmin: async () => ({ email: 'admin@example.com' }),
    errorResponse: () => Response.json({ error: 'Operation failed safely' }, { status: 500 }),
    recordSlugChange: async () => {},
    supabase: { from(table) {
      const call = { table, operation: 'read', filters: [] }
      calls.push(call)
      const query = {
        select(columns, options) { call.columns = columns; call.options = options; return query },
        eq(key, value) { call.filters.push([key, value]); return query },
        in(key, value) { call.filters.push([key, value]); return query },
        order() { return query },
        update(row) { call.operation = 'update'; call.row = row; return query },
        delete() { call.operation = 'delete'; return query },
        maybeSingle() { return query }, single() { return query },
        then(resolve, reject) { return Promise.resolve(respond(call)).then(resolve, reject) },
      }
      return query
    } },
  })
  vm.runInContext(source.replace(/^import .*$/gm, '').replace(/export async function/g, 'async function'), context)
  return { calls, context, post: body => context.POST(new Request('https://example.com/api/admin/products', { method: 'POST', body: JSON.stringify(body) })) }
}

test('a failed SKU read cannot appear as an empty editable product', async () => {
  const { context } = harness(call => call.table === 'products' ? { data: { id: 'p' } } : { data: null, error: true })
  assert.equal((await context.GET(new Request('https://example.com/api/admin/products?id=p'))).status, 500)
})

test('product deletion stops before writes when order-history verification fails or returns no count', async () => {
  for (const result of [{ count: null, error: true }, { count: null }]) {
    const h = harness(() => result)
    assert.equal((await h.post({ action: 'delete', product: { id: 'p' } })).status, 500)
    assert.ok(h.calls.every(call => call.operation === 'read'))
  }
})

test('historical products are deactivated, never deleted, and failed writes are reported', async () => {
  for (const fail of [false, true]) {
    const h = harness(call => call.table === 'order_items' ? { count: 1 } : { error: fail })
    assert.equal((await h.post({ action: 'delete', product: { id: 'p' } })).status, fail ? 500 : 200)
    assert.ok(h.calls.every(call => call.operation !== 'delete'))
    assert.equal(h.calls.find(call => call.operation === 'update').row.is_active, false)
  }
})

test('a protected SKU deletion failure cannot continue deleting the parent product or claim success', async () => {
  const h = harness(call => call.table === 'order_items' ? { count: 0 } : { error: true })
  assert.equal((await h.post({ action: 'delete', product: { id: 'p' } })).status, 500)
  assert.ok(!h.calls.some(call => call.table === 'products'))
})

test('stale or foreign SKU identifiers are rejected before the product is changed', async () => {
  const h = harness(call => ({ data: call.table === 'products' ? { slug: 'ribbon' } : [{ id: 'owned' }] }))
  assert.equal((await h.post({ action: 'update', product: { id: 'p', slug: 'ribbon' }, skus: [{ id: 'foreign' }] })).status, 409)
  assert.ok(h.calls.every(call => call.operation === 'read'))
})

test('SKU removal cannot continue if order reference lookup fails', async () => {
  const h = harness(call => {
    if (call.table === 'order_items') return { error: true }
    return { data: call.table === 'products' ? { slug: 'ribbon' } : [{ id: 'owned' }] }
  })
  const response = await h.post({ action: 'update', product: { id: 'p', slug: 'ribbon' }, skus: [], deletedSkuIds: ['owned'] })
  assert.equal(response.status, 500)
  assert.ok(!h.calls.some(call => call.operation === 'delete'))
  assert.ok(!h.calls.some(call => call.table === 'product_skus' && call.operation === 'update'))
})

test('deliberate stock edits compare against the loaded value and reject an intervening checkout', async () => {
  const h = harness(call => {
    if (call.operation === 'update' && call.table === 'product_skus') return { data: null }
    return { data: call.table === 'products' ? { slug: 'ribbon' } : [{ id: 'owned' }] }
  })
  const response = await h.post({ action: 'update', product: { id: 'p', slug: 'ribbon' }, skus: [{ id: 'owned', stock_qty: 20, loaded_stock_qty: 10 }] })
  assert.equal(response.status, 409)
  const stockUpdate = h.calls.find(call => call.table === 'product_skus' && call.operation === 'update')
  assert.ok(stockUpdate.filters.some(([key, value]) => key === 'stock_qty' && value === 10))
  assert.ok(stockUpdate.filters.some(([key, value]) => key === 'product_id' && value === 'p'))
})
