const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '../admin/pages/products/product-editor-helpers.js'),
  'utf8'
)
const helpers = new Function(
  source.replace(/^export /gm, '') +
  ';return { buildCombos, buildSkuRows, createSku, buildProductPayload, loadAttributeConfig, loadSku }'
)()

test('buildCombos creates the cartesian product of filled attribute values', () => {
  const combos = helpers.buildCombos([
    { name: '颜色', options: [{ value: 'Red' }, { value: 'Blue' }] },
    { name: '宽度', options: [{ value: '10' }, { value: '20' }] },
  ])
  assert.deepEqual(combos, [
    { 颜色: 'Red', 宽度: '10' },
    { 颜色: 'Red', 宽度: '20' },
    { 颜色: 'Blue', 宽度: '10' },
    { 颜色: 'Blue', 宽度: '20' },
  ])
})

test('buildCombos ignores attributes without a name or usable values', () => {
  assert.deepEqual(helpers.buildCombos([
    { name: '', options: [{ value: 'Red' }] },
    { name: '宽度', options: [{ value: ' ' }] },
  ]), [])
})

test('buildSkuRows preserves existing rows and reports removed SKUs', () => {
  const existing = { id: 'sku-1', attributes: { 颜色: 'Red' }, price_gbp: '9.00' }
  const kept = helpers.buildSkuRows([existing], [{ 颜色: 'Red' }, { 颜色: 'Blue' }])
  assert.equal(kept.next.length, 2)
  assert.equal(kept.next[0], existing)
  assert.equal(kept.next[1].attributes.颜色, 'Blue')
  assert.deepEqual(kept.removedIds, [])

  const removed = helpers.buildSkuRows([existing], [{ 颜色: 'Blue' }])
  assert.deepEqual(removed.removedIds, ['sku-1'])
  assert.equal(removed.next[0].attributes.颜色, 'Blue')
})

test('createSku starts with the configured attribute names and zero stock', () => {
  const sku = helpers.createSku([{ name: '颜色' }, { name: '  ' }, { name: '宽度' }])
  assert.deepEqual(sku.attributes, { 颜色: '', 宽度: '' })
  assert.equal(sku.stock_qty, 0)
  assert.equal(sku.is_active, true)
})

test('buildProductPayload preserves the existing server contract', () => {
  const payload = helpers.buildProductPayload({
    isNew: false,
    product: { id: 'product-1' },
    form: {
      name: ' Silk Ribbon ', slug: 'silk-ribbon', description: ' Soft ',
      collection: 'fine-silk-ribbons', active: false, featured: true, sort_order: '4',
    },
    images: ['main.jpg'],
    attrConfig: [{ name: '颜色', options: [{ value: 'Red', image: 'red.jpg' }, { value: ' ' }] }],
    specifications: [{ key: 'Material', value: 'Silk' }, { key: ' ', value: 'ignored' }],
    skus: [{
      id: 'sku-1', _loaded_stock_qty: 7,
      attributes: { 颜色: 'Red', 宽度: '10', 长度: '3' },
      price_gbp: '12.50', stock_qty: '5', is_active: false, images: ['sku.jpg'],
    }],
    deletedSkuIds: ['sku-2'],
  })

  assert.equal(payload.action, 'update')
  assert.equal(payload.product.id, 'product-1')
  assert.equal(payload.product.name, 'Silk Ribbon')
  assert.equal(payload.product.slug, 'silk-ribbon')
  assert.equal(payload.product.description, 'Soft')
  assert.equal(payload.product.is_active, false)
  assert.equal(payload.product.is_featured, true)
  assert.equal(payload.product.sort_order, 4)
  assert.deepEqual(payload.product.attribute_config, [{ name: '颜色', options: [{ value: 'Red', image: 'red.jpg' }] }])
  assert.deepEqual(payload.product.specifications, [{ key: 'Material', value: 'Silk' }])
  assert.equal(payload.skus[0].colour, 'Red')
  assert.equal(payload.skus[0].width_mm, 10)
  assert.equal(payload.skus[0].length_m, 3)
  assert.equal(payload.skus[0].loaded_stock_qty, 7)
  assert.equal(payload.skus[0].price_gbp, '12.50')
  assert.equal(payload.skus[0].stock_qty, '5')
  assert.equal(payload.skus[0].is_active, false)
  assert.deepEqual(payload.skus[0].images, ['sku.jpg'])
  assert.deepEqual(payload.deletedSkuIds, ['sku-2'])
})

test('buildProductPayload creates a product without an id and maps legacy option strings', () => {
  const payload = helpers.buildProductPayload({
    isNew: true,
    product: 'new',
    form: { name: 'New', slug: 'new', description: '', collection: 'c', active: true, featured: false, sort_order: '' },
    images: [],
    attrConfig: [{ name: '颜色', options: ['Red'] }],
    specifications: [],
    skus: [{ attributes: {}, price_gbp: '1.00', stock_qty: 1, is_active: true }],
    deletedSkuIds: [],
  })
  assert.equal(payload.action, 'create')
  assert.equal(payload.product.id, undefined)
  assert.deepEqual(payload.product.attribute_config, [{ name: '颜色', options: [{ value: 'Red', image: '' }] }])
  assert.equal(payload.skus[0].loaded_stock_qty, undefined)
  assert.equal(payload.skus[0].colour, '默认')
})

test('loadAttributeConfig and loadSku normalize persisted values', () => {
  const config = helpers.loadAttributeConfig([{ name: '颜色', options: ['Red', { value: 'Blue', image: 'blue.jpg' }] }])
  assert.deepEqual(config[0].options, [{ value: 'Red', image: '' }, { value: 'Blue', image: 'blue.jpg' }])
  const sku = helpers.loadSku({ id: 'sku-1', stock_qty: 3 })
  assert.deepEqual(sku.attributes, {})
  assert.equal(sku._loaded_stock_qty, 3)
})
