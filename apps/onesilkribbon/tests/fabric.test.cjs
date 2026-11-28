const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'fabric.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
const fabric = new Function(`${source};return {
  FABRIC_COLLECTION,FABRIC_WEIGHT_GROUPS,fabricView,fabricQuantityError,fabricQuantityLimit,
  fabricSkuDescription,fabricFilterSlug,buildFabricFilters,filterFabricProducts,fabricDraftTemplate,
  fabricSpecRows,fabricType,fabricWeight,fabricWidth,fabricUses,fabricMaxCutM,parseFabricMaxCut,
  fabricMomme,parseFabricMomme,fabricWeightGroup,fabricPublishErrors,normalizeFabricDraftSkus,
  orderFabricSkus
}`)()

const product = {
  id: 'fabric-product',
  name: '16 Momme Silk Crêpe de Chine',
  slug: '16-momme-silk-crepe-de-chine',
  collection: 'silk-fabric',
  description: 'A matte, dry-handed cloth for blouses and bridal separations. Cut to order.',
  images: ['https://example.test/crepe.jpg'],
  specifications: [
    { key: 'Fabric type', value: 'Crêpe de Chine' },
    { key: 'Weight', value: '16 momme' },
    { key: 'Width', value: '114 cm' },
    { key: 'Use', value: 'Dresses, Bridal & Décor' },
    { key: 'Max continuous cut', value: '12 m' },
    { key: 'Weave', value: 'Crêpe weave' },
  ],
  attribute_config: [{ name: 'Colour', options: ['Pearl White', 'Oyster'] }],
}

const skus = [
  { id: 'sku-pearl', colour: 'Pearl White', colour_hex: '#EFE7D9', price_gbp: '28.00', stock_qty: 8, is_active: true },
  { id: 'sku-oyster', colour: 'Oyster', colour_hex: '#C9BCA8', price_gbp: '30.00', stock_qty: 4, is_active: true },
  { id: 'sku-off', colour: 'Ink', colour_hex: '#2A2522', price_gbp: '28.00', stock_qty: 9, is_active: false },
]

const withSpec = (key, value) => ({
  ...product,
  specifications: product.specifications.map(spec => spec.key === key ? { ...spec, value } : spec),
})

test('fabric view reads type, weight, width, use, group and max continuous cut', () => {
  const view = fabric.fabricView(product, skus)
  assert.equal(view.fabric.type, 'Crêpe de Chine')
  assert.equal(view.fabric.weight, '16 momme')
  assert.equal(view.fabric.momme, 16)
  assert.equal(view.fabric.weightGroup.id, 'medium')
  assert.equal(view.fabric.width, '114 cm')
  assert.deepEqual(view.fabric.uses, ['Dresses', 'Bridal & Décor'])
  assert.equal(view.fabric.maxCutM, 12)
  assert.equal(view.fabric.priceFrom, 28)
  assert.deepEqual(view.fabric.colours.map(colour => colour.name), ['Pearl White', 'Oyster'])
  assert.equal(view.fabric.colours[0].stock, 8)
  assert.equal(view.fabric.image, 'https://example.test/crepe.jpg')
  assert.equal(fabric.fabricType(product), 'Crêpe de Chine')
  assert.equal(fabric.fabricWeight(product), '16 momme')
  assert.equal(fabric.fabricWidth(product), '114 cm')
  assert.equal(fabric.fabricMaxCutM(product), 12)
})

test('maximum continuous cut accepts only a complete positive integer metres value', () => {
  const valid = ['5', '5 m', '5m', '5 metres', '5 metre', '5 meters', '5 meter', '5 M', '5 米', '05']
  for (const value of valid) assert.equal(fabric.parseFabricMaxCut(value), 5, value)
  const invalid = [
    '-5 m', '+5', '0', '0 m', '5.5', '5.0 m', '5–8 m', '5-8 m', '5 to 8 m',
    '500 cm', '5 yd', '5 yards', 'about 5 m', '5 m approx', '5m2', '5.', '5,0',
    '5 m long', '5 m (roll)', '', null, undefined, '米', 'm',
  ]
  for (const value of invalid) assert.equal(fabric.parseFabricMaxCut(value), null, String(value))
  assert.equal(fabric.fabricMaxCutM(withSpec('Max continuous cut', '-5 m')), null)
  assert.equal(fabric.fabricQuantityError(withSpec('Max continuous cut', '-5 m'), skus[0], 1), 'The maximum continuous cut is not configured for this fabric')
  assert.equal(fabric.fabricQuantityError(withSpec('Max continuous cut', '500 cm'), skus[0], 1), 'The maximum continuous cut is not configured for this fabric')
  assert.equal(fabric.fabricQuantityError(withSpec('Max continuous cut', '5–8 m'), skus[0], 1), 'The maximum continuous cut is not configured for this fabric')
})

test('fabric quantity is whole metres, within stock and within one continuous cut', () => {
  assert.equal(fabric.fabricQuantityLimit(8, 12), 8)
  assert.equal(fabric.fabricQuantityLimit(20, 12), 12)
  assert.equal(fabric.fabricQuantityLimit(0, 12), 0)
  assert.equal(fabric.fabricQuantityLimit(8, null), 0)
  assert.equal(fabric.fabricQuantityError(product, skus[0], 1), null)
  assert.equal(fabric.fabricQuantityError(product, { ...skus[0], stock_qty: 20 }, 12), null)
  assert.match(fabric.fabricQuantityError(product, { ...skus[0], stock_qty: 20 }, 13), /longest continuous cut is 12 m/)
  assert.match(fabric.fabricQuantityError(product, skus[0], 1.5), /whole number/)
  assert.match(fabric.fabricQuantityError({ ...product, specifications: product.specifications.filter(spec => spec.key !== 'Max continuous cut') }, skus[0], 1), /not configured/)
  assert.match(fabric.fabricQuantityError(product, { ...skus[0], stock_qty: 2 }, 3), /Only 2 m/)
  assert.equal(fabric.fabricQuantityError({ ...product, collection: 'fine-silk-ribbons' }, skus[0], 100), null)
})

test('fabric descriptions and filter slugs stay consistent', () => {
  assert.equal(fabric.fabricSkuDescription(product, skus[0]), 'Pearl White · 114 cm wide · sold by the metre')
  assert.equal(fabric.fabricFilterSlug('Crêpe de Chine'), 'crepe-de-chine')
  assert.equal(fabric.fabricFilterSlug('Bridal & Décor'), 'bridal-decor')
  assert.equal(fabric.fabricFilterSlug('19 momme'), '19-momme')
})

test('momme parsing rejects ranges, approximations and unrelated units', () => {
  for (const value of ['19', '19 momme', '19momme', '19 姆米', '19.5 momme']) {
    assert.ok(fabric.parseFabricMomme(value) > 0, value)
  }
  for (const value of ['19 mm', 'about 19 momme', '19–20 momme', '19 momme approx', '0', '-19', '', null, '19g']) {
    assert.equal(fabric.parseFabricMomme(value), null, String(value))
  }
  assert.equal(fabric.fabricMomme(product), 16)
})

test('weight groups partition every valid momme exactly once at 12 and 20', () => {
  const group = value => fabric.fabricWeightGroup(value)?.id || null
  assert.equal(group(0.5), 'lightweight')
  assert.equal(group(6), 'lightweight')
  assert.equal(group(11.99), 'lightweight')
  assert.equal(group(12), 'medium')
  assert.equal(group(16), 'medium')
  assert.equal(group(19), 'medium')
  assert.equal(group(20), 'medium')
  assert.equal(group(20.01), 'heavier')
  assert.equal(group(21), 'heavier')
  assert.equal(group(22), 'heavier')
  assert.equal(group(30), 'heavier')
  for (const value of [0, -1, null, undefined, NaN, Infinity, '19']) assert.equal(group(value), null, String(value))
  for (let value = 0.5; value <= 30; value += 0.5) {
    const matches = fabric.FABRIC_WEIGHT_GROUPS.filter(item => {
      if (item.maxExclusive != null && value < item.maxExclusive) return true
      if (item.minInclusive != null && value >= item.minInclusive && value <= item.maxInclusive) return true
      if (item.minExclusive != null && value > item.minExclusive) return true
      return false
    })
    assert.equal(matches.length, 1, `momme ${value}`)
  }
  assert.deepEqual(fabric.FABRIC_WEIGHT_GROUPS.map(item => item.label), ['Lightweight', 'Medium', 'Heavier'])
  assert.deepEqual(fabric.FABRIC_WEIGHT_GROUPS.map(item => item.range), ['Under 12 momme', '12–20 momme', 'Over 20 momme'])
})

test('fabric filters use weight groups and do not classify invalid weights', () => {
  const second = {
    ...product,
    id: 'second',
    slug: '19-momme-silk-charmeuse',
    name: '19 Momme Silk Charmeuse',
    specifications: [
      { key: 'Fabric type', value: 'Charmeuse' },
      { key: 'Weight', value: '19 momme' },
      { key: 'Width', value: '114 cm' },
      { key: 'Use', value: 'Dresses, Home' },
      { key: 'Max continuous cut', value: '20 m' },
      { key: 'Weave', value: 'Satin weave' },
    ],
  }
  const light = {
    ...product,
    id: 'light',
    slug: '6-momme-silk-chiffon',
    name: '6 Momme Silk Chiffon',
    specifications: [
      { key: 'Fabric type', value: 'Chiffon' },
      { key: 'Weight', value: '6 momme' },
      { key: 'Width', value: '114 cm' },
      { key: 'Use', value: 'Dresses, Bridal & Décor' },
      { key: 'Max continuous cut', value: '15 m' },
      { key: 'Weave', value: 'Plain weave' },
    ],
  }
  const heavy = {
    ...product,
    id: 'heavy',
    slug: '22-momme-silk-charmeuse',
    name: '22 Momme Silk Charmeuse',
    specifications: [
      { key: 'Fabric type', value: 'Charmeuse' },
      { key: 'Weight', value: '22 momme' },
      { key: 'Width', value: '114 cm' },
      { key: 'Use', value: 'Bridal & Décor, Home' },
      { key: 'Max continuous cut', value: '8 m' },
      { key: 'Weave', value: 'Satin weave' },
    ],
  }
  const invalidWeight = {
    ...heavy,
    id: 'invalid-weight',
    slug: 'unknown-weight',
    name: 'Unknown Weight Charmeuse',
    specifications: heavy.specifications.map(spec => {
      if (spec.key === 'Weight') return { ...spec, value: 'about 22 momme' }
      if (spec.key === 'Use') return { ...spec, value: 'Home' }
      return spec
    }),
  }
  const products = [
    fabric.fabricView(product, skus),
    fabric.fabricView(second, [{ id: 'sku-lotus', colour: 'Lotus Pink', colour_hex: '#D9B6B3', price_gbp: '38.00', stock_qty: 10, is_active: true }]),
    fabric.fabricView(light, [{ id: 'sku-chiffon', colour: 'Pearl White', colour_hex: '#EFE7D9', price_gbp: '16.00', stock_qty: 20, is_active: true }]),
    fabric.fabricView(heavy, [{ id: 'sku-heavy', colour: 'Oyster', colour_hex: '#C9BCA8', price_gbp: '45.00', stock_qty: 3, is_active: true }]),
    fabric.fabricView(invalidWeight, [{ id: 'sku-invalid', colour: 'Oyster', colour_hex: '#C9BCA8', price_gbp: '20.00', stock_qty: 3, is_active: true }]),
  ]
  const options = fabric.buildFabricFilters(products)
  assert.deepEqual(options.types.map(item => item.label), ['Charmeuse', 'Chiffon', 'Crêpe de Chine'])
  assert.deepEqual(options.uses.map(item => item.label), ['Bridal & Décor', 'Dresses', 'Home'])
  assert.deepEqual(options.weights.map(item => item.label), ['Lightweight', 'Medium', 'Heavier'])
  assert.deepEqual(options.weights.map(item => item.count), [1, 2, 1])
  assert.deepEqual(options.colours.map(item => item.label), ['Lotus Pink', 'Oyster', 'Pearl White'])
  assert.deepEqual(fabric.filterFabricProducts(products, { type: 'crepe-de-chine' }).map(item => item.id), ['fabric-product'])
  assert.deepEqual(fabric.filterFabricProducts(products, { use: 'bridal-decor' }).map(item => item.id), ['fabric-product', 'light', 'heavy'])
  assert.deepEqual(fabric.filterFabricProducts(products, { weight: 'lightweight' }).map(item => item.id), ['light'])
  assert.deepEqual(fabric.filterFabricProducts(products, { weight: 'medium' }).map(item => item.id), ['fabric-product', 'second'])
  assert.deepEqual(fabric.filterFabricProducts(products, { weight: 'heavier' }).map(item => item.id), ['heavy'])
  assert.deepEqual(fabric.filterFabricProducts(products, { weight: 'medium', colour: 'lotus-pink' }).map(item => item.id), ['second'])
  assert.deepEqual(fabric.filterFabricProducts(products, { type: 'charmeuse', weight: 'heavier' }).map(item => item.id), ['heavy'])
})

test('fabric skus follow the configured colour order, not database row order', () => {
  const numericProduct = {
    ...product,
    attribute_config: [{ name: 'Colour', options: ['1#', '2#', '10#', '11#', '100#'] }],
  }
  const unordered = ['100#', '10#', '2#', '11#', '1#'].map((colour, index) => ({
    id: `sku-${index}`, colour, colour_hex: '#D4C5B0', price_gbp: '14.99', stock_qty: 999, is_active: true,
  }))
  assert.deepEqual(
    fabric.orderFabricSkus(numericProduct, unordered).map(sku => sku.colour),
    ['1#', '2#', '10#', '11#', '100#'],
  )
  const view = fabric.fabricView(numericProduct, fabric.orderFabricSkus(numericProduct, unordered))
  assert.deepEqual(view.fabric.colours.map(colour => colour.name), ['1#', '2#', '10#', '11#', '100#'])
})

test('fabric colour filters sort numeric labels naturally', () => {
  const numericProduct = {
    ...product,
    id: 'numeric-product',
    slug: 'numeric-product',
    attribute_config: [{ name: 'Colour', options: ['1#', '2#', '10#', '11#', '100#'] }],
  }
  const numericSkus = ['100#', '10#', '2#', '11#', '1#'].map((colour, index) => ({
    id: `numeric-sku-${index}`, colour, colour_hex: '#D4C5B0', price_gbp: '14.99', stock_qty: 999, is_active: true,
  }))
  const options = fabric.buildFabricFilters([fabric.fabricView(numericProduct, numericSkus)])
  assert.deepEqual(options.colours.map(colour => colour.label), ['1#', '2#', '10#', '11#', '100#'])
})

test('fabric publish validation reports every missing field and sellable SKU failure', () => {
  assert.deepEqual(fabric.fabricPublishErrors(product, skus), [])
  assert.deepEqual(fabric.fabricPublishErrors({ ...product, specifications: [] }, skus), [
    '面料品类 Fabric type（例如 Silk Chiffon、Silk Charmeuse 或 Crêpe de Chine）',
    '织法 Weave',
    '姆米 Weight（例如 19 momme）',
    '门幅 Width',
    '用途 Use',
    '最大连续裁剪 Max continuous cut（正整数米，例如 5 或 5 m）',
  ])
  const withoutType = {
    ...product,
    specifications: product.specifications.filter(spec => spec.key !== 'Fabric type'),
  }
  assert.equal(fabric.fabricType(withoutType), 'Silk fabric', 'display fallback stays for rendering')
  assert.match(fabric.fabricPublishErrors(withoutType, skus)[0], /Fabric type/)
  assert.match(fabric.fabricPublishErrors(withSpec('Fabric type', ' '), skus)[0], /Fabric type/)
  assert.match(fabric.fabricPublishErrors(withSpec('Max continuous cut', '-5 m'), skus)[0], /最大连续裁剪/)
  assert.match(fabric.fabricPublishErrors(withSpec('Weight', '19 mm'), skus)[0], /姆米/)
  assert.match(fabric.fabricPublishErrors(product, []).at(-1), /至少一个启用的颜色 SKU/)
  assert.match(fabric.fabricPublishErrors(product, [{ ...skus[0], is_active: false }]).at(-1), /至少一个启用的颜色 SKU/)
  assert.match(fabric.fabricPublishErrors(product, [{ ...skus[0], colour: '默认' }]).at(-1), /至少一个启用的颜色 SKU/)
  assert.match(fabric.fabricPublishErrors(product, [{ ...skus[0], price_gbp: '0' }]).at(-1), /至少一个启用的颜色 SKU/)
  assert.deepEqual(fabric.fabricPublishErrors(product, [{ ...skus[0], stock_qty: 0 }]), [])
  assert.deepEqual(fabric.fabricPublishErrors(product, [{ ...skus[0], stock_qty: 0, price_gbp: '28.00' }]), [])
})

test('fabric draft normalization only fills blank price and stock with zero', () => {
  const normalized = fabric.normalizeFabricDraftSkus([
    { id: 'blank', price_gbp: '', stock_qty: ' ' },
    { id: 'null', price_gbp: null, stock_qty: null },
    { id: 'kept', price_gbp: '28.00', stock_qty: 4, colour: 'Oyster' },
  ])
  assert.equal(normalized[0].price_gbp, 0)
  assert.equal(normalized[0].stock_qty, 0)
  assert.equal(normalized[1].price_gbp, 0)
  assert.equal(normalized[1].stock_qty, 0)
  assert.equal(normalized[2].price_gbp, '28.00')
  assert.equal(normalized[2].stock_qty, 4)
  assert.equal(normalized[2].colour, 'Oyster')
})

test('the admin fabric draft starts inactive with the required specification keys', () => {
  const draft = fabric.fabricDraftTemplate()
  assert.equal(draft.collection, 'silk-fabric')
  assert.equal(draft.active, false)
  assert.deepEqual(draft.attributeConfig[0].options, [{ value: '', image: '' }])
  assert.deepEqual(draft.specifications.map(spec => spec.key), [
    'Fabric type', 'Weight', 'Width', 'Use', 'Max continuous cut', 'Weave',
  ])
  assert.ok(fabric.fabricSpecRows(product).some(([label, value]) => label === 'Max continuous cut' && value === '12 m'))
})

test('fabric only enters navigation and footer when an active fabric collection is available', () => {
  const navSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'storefront-nav.js'), 'utf8')
    .replace(/^export /gm, '')
  const nav = new Function(`${navSource};return {shopGroupsFor,footerShopLinksFor}`)()
  assert.equal(nav.shopGroupsFor(false).length, 3)
  assert.equal(nav.shopGroupsFor(true).length, 4)
  assert.equal(nav.shopGroupsFor(true)[1].href, '/collections/silk-fabric')
  assert.ok(nav.footerShopLinksFor(false).every(link => !link.href.includes('silk-fabric')))
  assert.ok(nav.footerShopLinksFor(true).some(link => link.href === '/collections/silk-fabric'))
})
