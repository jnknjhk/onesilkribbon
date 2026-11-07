const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = fs.readFileSync(path.resolve(__dirname, '../admin/api/products.js'), 'utf8')
const stockSource = fs.readFileSync(path.resolve(__dirname, '../admin/lib/stock-quantity.js'), 'utf8')
const parseStockQuantity = new Function(stockSource.replace(/^export /gm, '') + ';return parseStockQuantity')()

function harness(respond) {
  const calls = []
  const context = vm.createContext({
    Response, URL, Set, Date, Math,
    verifyAdmin: async () => ({ email: 'admin@example.com' }),
    errorResponse: () => Response.json({ error: 'Operation failed safely' }, { status: 500 }),
    parseStockQuantity,
    supabase: { from(table) {
      const call = { table, operation: 'read', filters: [] }
      calls.push(call)
      const query = {
        select(columns, options) { call.columns = columns; call.options = options; return query },
        eq(key, value) { call.filters.push([key, value]); return query },
        in(key, value) { call.filters.push([key, value]); return query },
        is(key, value) { call.filters.push([key, value]); return query },
        order() { return query },
        maybeSingle() { return query }, single() { return query },
        then(resolve, reject) { return Promise.resolve(respond(call)).then(resolve, reject) },
      }
      return query
    } },
  })
  vm.runInContext(source.replace(/^import .*$/gm, '').replace(/export async function/g, 'async function'), context)
  return { calls, context }
}

test('a failed SKU read cannot appear as an empty editable product', async () => {
  const { context } = harness(call => call.table === 'products' ? { data: { id: 'p' } } : { data: null, error: true })
  assert.equal((await context.GET(new Request('https://example.com/api/admin/products?id=p'))).status, 500)
})
