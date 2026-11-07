const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '../admin/api/products.js'),
  'utf8'
).replace(/^import .*$/gm, '').replace(/^export /gm, '')

const parseStockQuantity = value => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function compile({ rpc, from }) {
  return new Function(
    'supabase', 'verifyAdmin', 'errorResponse', 'parseStockQuantity', 'recordSlugChange',
    'cleanSearch', 'pageRange', 'readSettings', 'revalidateCatalog',
    source + ';return { POST }'
  )(
    { rpc, from },
    async () => ({ email: 'admin@example.com' }),
    () => Response.json({ error: 'Operation failed safely' }, { status: 500 }),
    parseStockQuantity,
    async () => {},
    q => String(q || ''),
    () => ({ page: 1, pageSize: 30, from: 0, to: 29 }),
    async () => ({}),
    async () => {}
  )
}

const createBody = (overrides = {}) => ({
  action: 'create',
  product: { name: 'Silk', slug: 'silk', description: '', collection: 'fine-silk-ribbons', is_active: true, is_featured: false, sort_order: 0, images: [], attribute_config: [], specifications: [] },
  skus: [],
  deletedSkuIds: [],
  ...overrides,
})

test('product create uses the atomic RPC and does not touch tables directly', async () => {
  let rpcCall = null
  const { POST } = compile({
    rpc: async (name, params) => { rpcCall = { name, params }; return { data: { id: 'prod-1', deleted: 0, deactivated: 0 }, error: null } },
    from: () => { throw new Error('legacy table write must not run') },
  })
  const body = createBody()
  body.product.id = 'must-not-be-sent'
  const response = await POST({ json: async () => body })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { id: 'prod-1' })
  assert.equal(rpcCall.name, 'admin_save_product')
  assert.equal(rpcCall.params.p_product.slug, 'silk')
  assert.equal(rpcCall.params.p_product.id, undefined)
  assert.deepEqual(rpcCall.params.p_skus, [])
  assert.deepEqual(rpcCall.params.p_deleted_sku_ids, [])
})

test('product update uses the atomic RPC and reports removed SKUs', async () => {
  let rpcCall = null
  const { POST } = compile({
    rpc: async (name, params) => { rpcCall = { name, params }; return { data: { ok: true, deleted: 2, deactivated: 1 }, error: null } },
    from: () => { throw new Error('legacy table write must not run') },
  })
  const body = createBody({
    action: 'update',
    product: { ...createBody().product, id: 'prod-1' },
  })
  const response = await POST({ json: async () => body })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, deleted: 2, deactivated: 1 })
  assert.equal(rpcCall.name, 'admin_save_product')
  assert.equal(rpcCall.params.p_product.id, 'prod-1')
})

test('atomic business errors are returned without falling back to legacy writes', async () => {
  const { POST } = compile({
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'stock_conflict' } }),
    from: () => { throw new Error('legacy table write must not run') },
  })
  const body = createBody({
    action: 'update',
    product: { ...createBody().product, id: 'prod-1' },
  })
  const response = await POST({ json: async () => body })
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /库存/)
})

test('a missing RPC safely falls back to the legacy path', async () => {
  let inserted = null
  const { POST } = compile({
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_save_product' } }),
    from(table) {
      assert.equal(table, 'products')
      const query = {
        insert(row) { inserted = row; return query },
        select() { return query },
        async single() { return { data: { id: 'legacy-product' }, error: null } },
      }
      return query
    },
  })
  const response = await POST({ json: async () => createBody() })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { id: 'legacy-product' })
  assert.equal(inserted.slug, 'silk')
})

test('product delete uses the atomic RPC and keeps soft-deleted history', async () => {
  let rpcCall = null
  const { POST } = compile({
    rpc: async (name, params) => { rpcCall = { name, params }; return { data: { ok: true, softDeleted: true, orderItemCount: 3 }, error: null } },
    from: () => { throw new Error('legacy table write must not run') },
  })
  const body = createBody({ action: 'delete', product: { id: 'prod-1' } })
  const response = await POST({ json: async () => body })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.softDeleted, true)
  assert.match(result.message, /3 条历史订单/)
  assert.equal(rpcCall.name, 'admin_delete_product')
  assert.equal(rpcCall.params.p_product_id, 'prod-1')
})
