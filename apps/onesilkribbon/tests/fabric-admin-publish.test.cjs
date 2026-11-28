const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const load = (file, bindings, names) => {
  const source = read(file).replace(/^import .*$/gm, '').replace(/^export /gm, '')
  return new Function(...Object.keys(bindings), `${source};return {${names}}`)(...Object.values(bindings))
}

const fabric = load('lib/fabric.js', {}, 'FABRIC_COLLECTION,fabricPublishErrors,normalizeFabricDraftSkus')
const { parseStockQuantity } = load('admin/lib/stock-quantity.js', {}, 'parseStockQuantity')

const validSpecifications = [
  { key: 'Fabric type', value: 'Crêpe de Chine' },
  { key: 'Weight', value: '19 momme' },
  { key: 'Width', value: '114 cm' },
  { key: 'Use', value: 'Dresses, Bridal & Décor' },
  { key: 'Max continuous cut', value: '5 m' },
  { key: 'Weave', value: 'Crêpe weave' },
]

function api({ existing = null, rpcResult = { data: { id: 'created-id' }, error: null } } = {}) {
  const calls = []
  const supabase = {
    from() {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existing, error: null }),
          }),
        }),
      }
    },
    rpc: async (name, args) => {
      calls.push({ name, args })
      return rpcResult
    },
  }
  const bindings = {
    supabase,
    verifyAdmin: async () => ({ id: 'admin' }),
    errorResponse: (error, options) => Response.json({ error: error?.message || 'error', tag: options?.tag }, { status: 500 }),
    cleanSearch: value => value,
    pageRange: () => ({}),
    readSettings: async () => ({}),
    isMissingRpc: () => false,
    parseStockQuantity,
    revalidateCatalog: () => {},
    recordAdminAction: async () => {},
    canAccessInternalProductNames: async () => true,
    ...fabric,
    Response,
  }
  const source = read('admin/api/products.js').replace(/^import .*$/gm, '').replace(/^export /gm, '')
  const POST = new Function(...Object.keys(bindings), `${source};return POST`)(...Object.values(bindings))
  return { POST, calls }
}

const request = body => ({ json: async () => body })

const draftBody = {
  action: 'create',
  product: {
    name: 'Test Fabric Draft',
    slug: 'test-fabric-draft',
    collection: 'silk-fabric',
    is_active: false,
    specifications: [],
    attribute_config: [],
  },
  skus: [
    { attributes: { Colour: '' }, colour: '默认', price_gbp: '', stock_qty: '', is_active: true },
  ],
  deletedSkuIds: [],
}

const validBody = {
  action: 'create',
  product: {
    name: '19 Momme Silk Crêpe de Chine',
    slug: '19-momme-silk-crepe-de-chine',
    collection: 'silk-fabric',
    is_active: true,
    specifications: validSpecifications,
    attribute_config: [{ name: 'Colour', options: ['Oyster'] }],
  },
  skus: [
    { attributes: { Colour: 'Oyster' }, colour: 'Oyster', colour_hex: '#C9BCA8', price_gbp: '28.00', stock_qty: 0, is_active: true },
  ],
  deletedSkuIds: [],
}

test('a fabric draft may be saved with missing price and stock (stored as zero)', async () => {
  const { POST, calls } = api()
  const response = await POST(request(draftBody))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { id: 'created-id' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'admin_save_product')
  assert.equal(calls[0].args.p_skus[0].price_gbp, 0)
  assert.equal(calls[0].args.p_skus[0].stock_qty, 0)
})

test('an invalid fabric cannot be published and leaves no write behind', async () => {
  for (const body of [
    { ...validBody, product: { ...validBody.product, is_active: true, specifications: [] } },
    { ...validBody, skus: [] },
    { ...validBody, skus: [{ ...validBody.skus[0], price_gbp: '0' }] },
    { ...validBody, skus: [{ ...validBody.skus[0], colour: '默认', attributes: { Colour: '' } }] },
    { ...validBody, skus: [{ ...validBody.skus[0], is_active: false }] },
  ]) {
    const { POST, calls } = api()
    const response = await POST(request(body))
    assert.equal(response.status, 400)
    const payload = await response.json()
    assert.ok(Array.isArray(payload.fields) && payload.fields.length > 0)
    assert.match(payload.error, /面料上架前/)
    assert.equal(calls.length, 0, 'validation failure must not call the save RPC')
  }
})

test('an invalid maximum continuous cut blocks publication with that field named', async () => {
  for (const maxCut of ['-5 m', '500 cm', '5–8 m', '5.5 m', '0']) {
    const { POST, calls } = api()
    const body = {
      ...validBody,
      product: {
        ...validBody.product,
        specifications: validSpecifications.map(spec =>
          spec.key === 'Max continuous cut' ? { ...spec, value: maxCut } : spec
        ),
      },
    }
    const response = await POST(request(body))
    assert.equal(response.status, 400, maxCut)
    const payload = await response.json()
    assert.ok(payload.fields.some(field => field.includes('最大连续裁剪')), maxCut)
    assert.equal(calls.length, 0)
  }
})

test('a valid fabric can be published, including a sold-out colour with stock zero', async () => {
  const { POST, calls } = api()
  const response = await POST(request(validBody))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { id: 'created-id' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_skus[0].price_gbp, '28.00')
  assert.equal(calls[0].args.p_skus[0].stock_qty, 0)
})

test('an existing draft updated without an explicit active flag is still treated as a draft', async () => {
  const { POST, calls } = api({
    existing: { collection: 'silk-fabric', is_active: false, specifications: [] },
  })
  const body = {
    action: 'update',
    product: { id: '00000000-0000-4000-8000-000000000001', name: 'Draft update', slug: 'draft-update' },
    skus: [{ id: '00000000-0000-4000-8000-000000000002', loaded_stock_qty: 0, attributes: { Colour: '' }, colour: '默认', price_gbp: '', stock_qty: '', is_active: true }],
    deletedSkuIds: [],
  }
  const response = await POST(request(body))
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_skus[0].price_gbp, 0)
})

test('an existing published fabric updated without fields is validated before writing', async () => {
  const { POST, calls } = api({
    existing: { collection: 'silk-fabric', is_active: true, specifications: [] },
  })
  const body = {
    action: 'update',
    product: { id: '00000000-0000-4000-8000-000000000001', name: 'Published update', slug: 'published-update' },
    skus: [{ id: '00000000-0000-4000-8000-000000000002', loaded_stock_qty: 0, attributes: { Colour: 'Oyster' }, colour: 'Oyster', price_gbp: '28.00', stock_qty: 0, is_active: true }],
    deletedSkuIds: [],
  }
  const response = await POST(request(body))
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.ok(payload.fields.includes('面料品类 Fabric type（例如 Silk Chiffon、Silk Charmeuse 或 Crêpe de Chine）'))
  assert.ok(payload.fields.includes('织法 Weave'))
  assert.equal(calls.length, 0)
})

test('a draft may omit Fabric type and still save', async () => {
  const { POST, calls } = api()
  const response = await POST(request({
    ...draftBody,
    product: {
      ...draftBody.product,
      specifications: [{ key: 'Weave', value: 'Crêpe weave' }],
    },
  }))
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_skus[0].price_gbp, 0)
})

test('a fabric with Weave but no Fabric type cannot be published', async () => {
  const { POST, calls } = api()
  const body = {
    ...validBody,
    product: {
      ...validBody.product,
      specifications: validSpecifications.filter(spec => spec.key !== 'Fabric type'),
    },
  }
  const response = await POST(request(body))
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.ok(payload.fields.some(field => field.includes('Fabric type')))
  assert.equal(calls.length, 0)
})

test('explicit null or non-array specifications are rejected before the save RPC', async () => {
  for (const specifications of [null, {}, '[]', 42, true]) {
    const { POST, calls } = api({
      existing: { collection: 'silk-fabric', is_active: true, specifications: validSpecifications },
    })
    const body = {
      action: 'update',
      product: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Invalid specifications',
        slug: 'invalid-specifications',
        collection: 'silk-fabric',
        is_active: true,
        specifications,
      },
      skus: [{ id: '00000000-0000-4000-8000-000000000002', loaded_stock_qty: 0, ...validBody.skus[0] }],
      deletedSkuIds: [],
    }
    const response = await POST(request(body))
    assert.equal(response.status, 400, String(specifications))
    const payload = await response.json()
    assert.match(payload.error, /specifications|规格参数/)
    assert.equal(calls.length, 0, `must not call RPC for ${String(specifications)}`)
  }
})

test('publishing a fabric with an explicitly empty specification array is rejected', async () => {
  const { POST, calls } = api({
    existing: { collection: 'silk-fabric', is_active: true, specifications: validSpecifications },
  })
  const body = {
    action: 'update',
    product: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Clear specifications',
      slug: 'clear-specifications',
      collection: 'silk-fabric',
      is_active: true,
      specifications: [],
    },
    skus: [{ id: '00000000-0000-4000-8000-000000000002', loaded_stock_qty: 0, ...validBody.skus[0] }],
    deletedSkuIds: [],
  }
  const response = await POST(request(body))
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.ok(payload.fields.some(field => field.includes('Fabric type')))
  assert.equal(calls.length, 0)
})

test('an update that omits specifications validates and saves the retained old array', async () => {
  const { POST, calls } = api({
    existing: { collection: 'silk-fabric', is_active: true, specifications: validSpecifications },
  })
  const body = {
    action: 'update',
    product: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Keep specifications',
      slug: 'keep-specifications',
      collection: 'silk-fabric',
      is_active: true,
    },
    skus: [{ id: '00000000-0000-4000-8000-000000000002', loaded_stock_qty: 0, ...validBody.skus[0] }],
    deletedSkuIds: [],
  }
  const response = await POST(request(body))
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args.p_product.specifications, validSpecifications)
  assert.equal(calls[0].args.p_product.is_active, true)
})
