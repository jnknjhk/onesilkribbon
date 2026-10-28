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

test('legacy oversized, whitespace and invalid SKU codes fall back to existing unique IDs without truncation', async () => {
  const { productGroupSchema, structuredSku } = await helper
  const prefix = 'r'.repeat(50)
  const legacy = [
    { ...skus[0], id: '5dcb4fd8-4601-4000-8000-000000000001', sku_code: prefix + '-one' },
    { ...skus[1], id: '5dcb4fd8-4601-4000-8000-000000000002', sku_code: prefix + '-two' },
    { ...skus[0], id: '5dcb4fd8-4601-4000-8000-000000000003', sku_code: 'cinnamon-rose-0.5"-1 Yard' },
  ]
  const before = JSON.stringify(legacy)
  const group = productGroupSchema(product, legacy, 'https://example.org/ribbon')
  assert.deepEqual(group.hasVariant.map(v => v.sku), legacy.map(s => s.id))
  assert.equal(new Set(group.hasVariant.map(v => v.sku)).size, 3)
  assert.deepEqual(group.hasVariant.map(v => v.offers.url), legacy.map(s => `https://example.org/ribbon?sku=${s.id}`))
  assert.deepEqual(group.hasVariant.map(v => v.offers.price), ['3.00', '25.00', '3.00'])
  assert.equal(JSON.stringify(legacy), before, 'stored codes and purchasing records are not rewritten')
  assert.equal(structuredSku({ ...skus[0], sku_code: prefix }), prefix)
  for (const sku_code of ['', ' leading', 'line\nbreak', 'zero\u0000byte', '\ud800']) {
    assert.equal(structuredSku({ ...skus[0], sku_code }), skus[0].id)
  }
  assert.equal(structuredSku({ id: 'also invalid', sku_code: prefix + 'x' }), undefined)
})

test('the seller links to the real organization policy without invented return terms or reviews', async () => {
  const { productGroupSchema } = await helper
  const layout = read('app/layout.jsx')
  const block = layout.slice(layout.indexOf('const organizationSchema ='), layout.indexOf('export const metadata'))
  const graph = new Function(block + '; return organizationSchema')()['@graph']
  const organization = graph.find(item => item['@type'] === 'Organization')
  assert.deepEqual(organization.hasMerchantReturnPolicy, {
    '@type': 'MerchantReturnPolicy', merchantReturnLink: 'https://onesilkribbon.com/shipping-returns',
  })
  const group = productGroupSchema(product, skus, 'https://example.org/ribbon')
  assert.equal(group.hasVariant[0].offers.seller['@id'], organization['@id'])
  assert.equal(group.hasVariant[0].offers.hasMerchantReturnPolicy, undefined, 'no incomplete policy overrides the organization')
  assert.doesNotMatch(JSON.stringify([organization, group]), /merchantReturnDays|MerchantReturnUnlimitedWindow|MerchantReturnNotPermitted|aggregateRating|"review"/)
})

test('confirmed standard catalogue returns reach every offer with a finite window and customer-paid postage', async () => {
  const { productReturnPolicy, STANDARD_RETURN_DAYS } = await load(read('lib/merchant-return-policy.js'))
  const { productGroupSchema } = await helper
  assert.equal(STANDARD_RETURN_DAYS, 14)
  for (const collection of ['fine-silk-ribbons', 'hand-frayed-silk-ribbons', 'vintage-inspired-ribbons', 'studio-tools', 'handcrafted-adornments']) {
    const policy = productReturnPolicy()
    const group = productGroupSchema({ ...product, collection }, skus, 'https://example.org/ribbon', undefined, policy)
    for (const variant of group.hasVariant) {
      const actual = variant.offers.hasMerchantReturnPolicy
      assert.equal(actual['@type'], 'MerchantReturnPolicy', collection)
      assert.equal(actual.applicableCountry, 'GB', collection)
      assert.equal(actual.returnPolicyCategory, 'https://schema.org/MerchantReturnFiniteReturnWindow', collection)
      assert.equal(actual.merchantReturnDays, 14, collection)
      assert.equal(actual.returnMethod, 'https://schema.org/ReturnByMail', collection)
      assert.equal(actual.returnFees, 'https://schema.org/ReturnFeesCustomerResponsibility', collection)
      assert.equal(actual.returnShippingFeesAmount, undefined, 'customer buys postage; no invented fee')
    }
    assert.deepEqual(group.hasVariant.map(v => v.offers.price), ['3.00', '25.00'])
    assert.doesNotMatch(JSON.stringify(group), /MerchantReturnNotPermitted|MerchantReturnUnlimitedWindow|aggregateRating|"review"/)
  }
})

let feedModuleVersion = 0
async function feedXml(feedProduct, feedSkus) {
  const variants = await helper
  globalThis.__seoVariants = variants
  globalThis.__seoDb = { from: table => ({ select: () => ({
    eq: async () => ({ data: [feedProduct] }),
    in: () => ({ eq: async () => ({ data: feedSkus.map(s => ({ ...s, product_id: feedProduct.id })) }) }),
  }) }) }
  try {
    const source = read('app/api/google-feed/route.js')
      .replace("import { supabaseAdmin } from '@osr/core/lib/supabase'", 'const supabaseAdmin = globalThis.__seoDb')
      .replace("import { variantUrl, variantImage, merchantVariantAttributes, skuLabel } from '@/lib/product-variants'", 'const { variantUrl, variantImage, merchantVariantAttributes, skuLabel } = globalThis.__seoVariants')
    const { GET } = await load(`${source}\n// isolated fixture ${++feedModuleVersion}`)
    const response = await GET()
    assert.equal(response.status, 200)
    return await response.text()
  } finally { delete globalThis.__seoDb; delete globalThis.__seoVariants }
}

test('feed advertises matching variant URLs, sizes and prices', async () => {
  const xml = await feedXml(product, skus)
  assert.match(xml, /\?sku=sku-1<\/link>/)
  assert.match(xml, /\?sku=sku-2<\/link>/)
  assert.match(xml, /<g:price>25.00 GBP<\/g:price>/)
  assert.match(xml, /<g:size>5mm × 10m<\/g:size>/)
})

test('custom COLOR and WIDTH variants expose the missing merchant fields in both JSON-LD and feed', async () => {
  const { productGroupSchema } = await helper
  const customProduct = { ...product, description: '<p>Pure silk ribbon for embroidery.</p>', attribute_config: [{ name: 'COLOR' }, { name: 'WIDTH' }] }
  const variants = [
    { ...skus[0], colour: '默认', width_mm: null, length_m: null, attributes: { COLOR: 'Peach Sorbet', WIDTH: '2mm' } },
    { ...skus[1], colour: '默认', width_mm: null, length_m: null, attributes: { COLOR: 'Berry Red', WIDTH: '13mm' } },
  ]
  const group = productGroupSchema(customProduct, variants, 'https://example.org/ribbon')
  assert.deepEqual(group.variesBy, ['https://schema.org/color', 'https://schema.org/size'])
  assert.deepEqual(group.hasVariant.map(v => [v.color, v.size]), [['Peach Sorbet', '2mm'], ['Berry Red', '13mm']])
  assert.match(group.hasVariant[0].name, /Peach Sorbet, 2mm/)
  assert.match(group.hasVariant[1].description, /Berry Red, 13mm.*Pure silk ribbon for embroidery\./)
  assert.equal(group.hasVariant[1].offers.price, '25.00')
  assert.equal(group.hasVariant[1].offers.availability, 'https://schema.org/OutOfStock')
  const xml = await feedXml(customProduct, variants)
  assert.match(xml, /<g:color>Peach Sorbet<\/g:color>/)
  assert.match(xml, /<g:size>13mm<\/g:size>/)
  assert.match(xml, /<title>Ribbon - Berry Red, 13mm<\/title>/)
})

test('merchant attributes prefer displayed custom values, support Chinese names and omit unknown dimensions', async () => {
  const { merchantVariantAttributes, productGroupSchema } = await helper
  const custom = { ...product, attribute_config: [{ name: 'Colour' }] }
  assert.deepEqual(merchantVariantAttributes(custom, { ...skus[0], attributes: { Colour: 'Blue', WIDTH: '7mm', LENGTH: '1.5m' } }), { color: 'Blue', size: '7mm × 1.5m' })
  assert.deepEqual(merchantVariantAttributes(custom, { colour: '默认', attributes: { 颜色: 'Red', 尺寸: 'Small & narrow' } }), { color: 'Red', size: 'Small & narrow' })
  assert.deepEqual(merchantVariantAttributes(custom, { colour: '默认', attributes: { Finish: 'Satin' } }), {})
  const incomplete = productGroupSchema(custom, [
    { ...skus[0], width_mm: null, length_m: null, attributes: { Colour: 'Blue' } },
    { ...skus[1], attributes: { Colour: 'Red', Size: 'Small' } },
  ], 'https://example.org/ribbon')
  assert.deepEqual(incomplete.variesBy, ['https://schema.org/color'], 'do not require a missing or invented size')
  assert.equal(incomplete.hasVariant[0].size, undefined)
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

test('a journal query outage cannot turn a published article into a false 404', async () => {
  const source = read('app/journal/[slug]/page.jsx').replace(/\r\n/g, '\n')
  const start = source.indexOf('const getPost = cache')
  const query = source.slice(start, source.indexOf('\n})', start) + 3)
  const run = result => new Function('cache', 'supabaseServer', query + '; return getPost')(
    fn => fn,
    { from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => result }) },
  )('bridal-guide')
  await assert.rejects(run({ data: null, error: { message: 'Network unavailable' } }), /Unable to load journal article/)
  assert.equal(await run({ data: null, error: null }), null)
  assert.deepEqual(await run({ data: { title: 'Published guide' }, error: null }), { title: 'Published guide' })
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
