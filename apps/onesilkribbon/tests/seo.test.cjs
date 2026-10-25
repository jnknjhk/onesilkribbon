const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const helper = load(read('lib/product-variants.js'))
const product = { id: 'product-1', name: 'Ribbon', slug: 'ribbon', collection: 'fine-silk-ribbons', images: ['https://example.org/ribbon.jpg'] }
const skus = [
  { id: 'sku-1', sku_code: 'R1', colour: 'Gold', width_mm: 5, length_m: 1, price_gbp: 3, stock_qty: 2 },
  { id: 'sku-2', sku_code: 'R2', colour: 'Gold', width_mm: 5, length_m: 10, price_gbp: 25, stock_qty: 0, images: ['https://example.org/long.jpg'] },
]

test('variant URLs and initial selection identify the exact SKU, including out-of-stock variants', async () => {
  const { variantUrl, selectInitialSku } = await helper
  assert.equal(variantUrl('https://example.org/ribbon', skus[1]), 'https://example.org/ribbon?sku=sku-2')
  assert.equal(selectInitialSku(skus, 'sku-2'), skus[1])
  assert.equal(selectInitialSku(skus, 'another-product-sku'), skus[0])
  assert.equal(selectInitialSku([], 'sku-2'), null)
})

test('changing length selects the right SKU and impossible combinations cannot keep a stale SKU', async () => {
  const { skuAttributes, matchSku } = await helper
  assert.deepEqual(skuAttributes(product, skus[1]), { Colour: 'Gold', Width: '5mm', Length: '10m' })
  assert.equal(matchSku(product, skus, { Colour: 'Gold', Width: '5mm', Length: '10m' }, skus[0]), skus[1])
  assert.equal(matchSku(product, skus, { Width: '99mm' }, skus[0]), null)
  const custom = { ...product, attribute_config: [{ name: 'Size' }] }
  const customSku = { ...skus[0], attributes: { Size: 'Small' } }
  assert.deepEqual(skuAttributes(custom, customSku), { Size: 'Small' })
  assert.equal(matchSku(custom, [customSku], { Size: 'Small' }, customSku), customSku)
})

test('ProductGroup offers preserve per-SKU prices, images and stock without fabricated policies', async () => {
  const { productGroupSchema } = await helper
  const schema = productGroupSchema(product, [...skus, { id: 'invalid', price_gbp: 0 }, { id: 'disabled', price_gbp: 1, is_active: false }], 'https://example.org/ribbon')
  assert.equal(schema['@type'], 'ProductGroup')
  assert.equal(schema.hasVariant.length, 2)
  assert.equal(schema.hasVariant[1].offers['@type'], 'Offer')
  assert.equal(schema.hasVariant[1].offers.price, '25.00')
  assert.equal(schema.hasVariant[1].offers.availability, 'https://schema.org/OutOfStock')
  assert.equal(schema.hasVariant[1].offers.url, 'https://example.org/ribbon?sku=sku-2')
  assert.deepEqual(schema.hasVariant[1].image, skus[1].images)
  assert.doesNotMatch(JSON.stringify(schema), /merchantReturnDays|priceValidUntil|Mulberry Silk|AggregateOffer/)
})

test('feed advertises matching variant URLs, sizes and prices', async () => {
  const variants = await helper
  globalThis.__seoVariants = variants
  globalThis.__seoDb = { from: table => ({ select: () => ({
    eq: async () => ({ data: [product] }),
    in: () => ({ eq: async () => ({ data: skus.map(s => ({ ...s, product_id: product.id })) }) }),
  }) }) }
  try {
    const source = read('app/api/google-feed/route.js')
      .replace("import { supabaseAdmin } from '@osr/core/lib/supabase'", 'const supabaseAdmin = globalThis.__seoDb')
      .replace("import { variantUrl, variantImage } from '@/lib/product-variants'", 'const { variantUrl, variantImage } = globalThis.__seoVariants')
    const { GET } = await load(source)
    const response = await GET()
    const xml = await response.text()
    assert.equal(response.status, 200)
    assert.match(xml, /\?sku=sku-1<\/link>/)
    assert.match(xml, /\?sku=sku-2<\/link>/)
    assert.match(xml, /<g:price>25.00 GBP<\/g:price>/)
    assert.match(xml, /<g:size>5mm × 10m<\/g:size>/)
  } finally { delete globalThis.__seoDb; delete globalThis.__seoVariants }
})

test('utility routes have noindex and remain crawlable to expose that directive', async () => {
  for (const route of ['account', 'checkout', 'order-confirmed', 'track-order', 'admin-login', 'auth']) {
    const source = read(`app/${route}/layout.jsx`).replace(/export default[\s\S]*/, '')
    const { metadata } = await load(source)
    assert.equal(metadata.robots.index, false, route)
  }
  const { default: robots } = await load(read('app/robots.js'))
  assert.deepEqual(robots().rules[0].disallow, ['/api/'])
  assert.doesNotMatch(read('app/collections/[slug]/[productSlug]/page.jsx'), /AggregateOffer/)
})

test('large variant groups keep all offers but avoid duplicating the full photo gallery in every variant', async () => {
  const { productGroupSchema } = await helper
  const images = Array.from({ length: 30 }, (_, i) => `https://example.org/catalog/fine-silk-ribbon/high-resolution-studio-photograph-${i}.jpg`)
  const variants = Array.from({ length: 145 }, (_, i) => ({ ...skus[0], id: `sku-${i}`, price_gbp: 5.9 + i, images: i === 0 ? ['https://example.org/variant.jpg', 'https://example.org/variant-detail.jpg'] : [] }))
  const group = productGroupSchema({ ...product, images }, variants, 'https://example.org/ribbon')
  assert.equal(group.hasVariant.length, 145)
  assert.deepEqual(group.image, images, 'the group still exposes the full gallery')
  assert.deepEqual(group.hasVariant[0].image, ['https://example.org/variant.jpg'])
  assert.deepEqual(group.hasVariant[1].image, [images[0]])
  assert.deepEqual(group.hasVariant.map(v => v.offers.price), variants.map(v => Number(v.price_gbp).toFixed(2)))
  const repeated = { ...group, hasVariant: group.hasVariant.map(v => ({ ...v, image: images })) }
  assert.ok(Buffer.byteLength(JSON.stringify(group)) < Buffer.byteLength(JSON.stringify(repeated)) * 0.5)
})

test('a product query failure is an error, while a genuinely absent product remains not found', async () => {
  const source = read('app/collections/[slug]/[productSlug]/page.jsx').replace(/\r\n/g, '\n')
  const query = source.slice(source.indexOf('const getProduct = cache'), source.indexOf('\n})', source.indexOf('const getProduct = cache')) + 3)
  const run = result => new Function('cache', 'supabaseServer', query + '; return getProduct')(
    fn => fn,
    { from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => result }) },
  )('ribbon')
  await assert.rejects(run({ data: null, error: { message: 'Network unavailable' } }), /Unable to load product/)
  assert.equal(await run({ data: null, error: null }), null)
  assert.deepEqual(await run({ data: product, error: null }), product)
})

test('representative variant images match the selected colour before falling back to the general gallery', async () => {
  const { variantImage, productGroupSchema } = await helper
  const custom = { ...product, attribute_config: [{ name: 'Colour', options: [{ value: 'Blue', image: 'https://example.org/blue.jpg' }, { value: 'Red', image: 'https://example.org/red.jpg' }] }] }
  const blue = { ...skus[0], attributes: { Colour: 'Blue' }, images: [] }
  assert.equal(variantImage(custom, blue), 'https://example.org/blue.jpg')
  assert.equal(variantImage(custom, { ...blue, images: ['https://example.org/sku.jpg'] }), 'https://example.org/sku.jpg')
  assert.equal(variantImage(custom, { ...blue, attributes: { Colour: 'Unknown' } }), product.images[0])
  assert.equal(variantImage({ images: [] }, { images: [] }), null)
  assert.deepEqual(productGroupSchema(custom, [blue], 'https://example.org/ribbon').hasVariant[0].image, ['https://example.org/blue.jpg'])
})
