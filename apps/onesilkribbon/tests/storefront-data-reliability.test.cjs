const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')
const compile = (source, bindings, result) => new Function(...Object.keys(bindings),
  source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `; return ${result}`,
)(...Object.values(bindings))
const pricing = compile(read('lib/pricing.js'), {}, '({shippingSettingsFromApi,shippingDescription,calculateTotals})')
const editorial = compile(read('lib/journal-articles.js'), {}, '({HALLOWEEN_ARTICLE,mergePublishedJournalPosts})')
const flush = () => new Promise(resolve => setImmediate(resolve))

function database(result) {
  return { from(table) {
    const filters = {}
    const query = {
      select() { return query }, eq(key, value) { filters[key] = value; return query },
      in() { return query }, order() { return query },
      single: async () => result(table, filters),
      then(resolve, reject) { return Promise.resolve().then(() => result(table, filters)).then(resolve, reject) },
    }
    return query
  } }
}

function journal(result) {
  const source = read('app/journal/page.jsx')
  const prefix = source.split('function formatDate')[0]
  const body = source.split('export default async function JournalPage() {')[1].split('\n  return (')[0]
  return compile(prefix + `\nasync function render() {${body}\nreturn posts;}`, {
    cache: fn => fn, mergePublishedJournalPosts: editorial.mergePublishedJournalPosts, supabaseServer: database((_table, filters) => {
      assert.equal(filters.is_published, true)
      return result
    }),
  }, '({generateMetadata,render})')
}

test('journal read failures reject both metadata and content instead of publishing noindex or an empty list', async () => {
  const h = journal({ data: null, error: { message: 'Private database error' } })
  await assert.rejects(h.generateMetadata(), /Unable to load journal articles/)
  await assert.rejects(h.render(), /Unable to load journal articles/)
})

test('published editorial articles keep the Journal discoverable even when the CMS is empty', async () => {
  const empty = journal({ data: [], error: null })
  assert.equal((await empty.generateMetadata()).robots, undefined)
  assert.deepEqual(await empty.render(), [editorial.HALLOWEEN_ARTICLE])
  const posts = [{ slug: 'guide', title: 'Real guide' }]
  const published = journal({ data: posts, error: null })
  assert.equal((await published.generateMetadata()).robots, undefined)
  assert.deepEqual(await published.render(), [editorial.HALLOWEEN_ARTICLE, ...posts])
})

test('the combined Journal catalogue preserves CMS posts, sorts by publication date and avoids duplicate article URLs', () => {
  const posts = [
    { slug: 'later', published_at: '2026-11-01' },
    { slug: editorial.HALLOWEEN_ARTICLE.slug, title: 'CMS duplicate', published_at: '2026-10-01' },
    { slug: 'earlier', published_at: '2026-10-01' },
  ]
  const before = JSON.stringify(posts)
  const result = editorial.mergePublishedJournalPosts(posts)
  assert.deepEqual(result.map(post => post.slug), ['later', editorial.HALLOWEEN_ARTICLE.slug, 'earlier'])
  assert.equal(result[1].title, editorial.HALLOWEEN_ARTICLE.title)
  assert.equal(JSON.stringify(posts), before)
})

function collection({ productError = null, skuError = null } = {}) {
  const source = read('app/collections/[slug]/page.jsx')
  const prefix = source.split('export default async function CollectionPage')[0]
  const body = source.split('export default async function CollectionPage({ params }) {')[1].split('\n  const jsonLd')[0]
  return compile(prefix + `\nasync function render(params) {${body}\nreturn products;}`, {
    cache: fn => fn, COLLECTION_META: { fine: { name: 'Fine', desc: 'Real ribbon' } },
    notFound: () => { throw Error('Not found') },
    supabaseServer: database((table, filters) => {
      if (table === 'site_images') return { data: null }
      if (table === 'products') {
        assert.equal(filters.is_active, true)
        return { data: productError ? null : [{ id: 'ribbon', slug: 'ribbon', collection: 'fine' }], error: productError }
      }
      assert.equal(table, 'product_skus')
      return { data: skuError ? null : [{ product_id: 'ribbon', id: 'sku', price_gbp: '5.90' }], error: skuError }
    }),
  }, '({generateMetadata,render})')
}

test('collection product outages cannot become empty successful pages or noindex metadata', async () => {
  const h = collection({ productError: { message: 'Unavailable' } })
  await assert.rejects(h.generateMetadata({ params: { slug: 'fine' } }), /Unable to load collection products/)
  await assert.rejects(h.render({ slug: 'fine' }), /Unable to load collection products/)
})

test('collection price outages reject rather than fabricating zero prices', async () => {
  const h = collection({ skuError: { message: 'Unavailable' } })
  await assert.rejects(h.render({ slug: 'fine' }), /Unable to load collection prices/)
  const rows = await collection().render({ slug: 'fine' })
  assert.equal(rows[0].lowestPrice, 5.9)
  assert.equal(rows[0].firstSku.id, 'sku')
})

function policy(result) {
  const body = read('app/shipping-returns/page.jsx').split('export default async function ShippingReturns() {')[1].split('\n  return (')[0]
  return compile(`async function render() {${body}\nreturn shippingDesc;}`, {
    ...pricing, supabaseServer: database(() => result),
  }, 'render')()
}

test('delivery policy preserves fractional thresholds and rejects database failures', async () => {
  const description = await policy({ data: [
    { key: 'shipping_rate', value: '2.50' }, { key: 'free_shipping_threshold', value: '45.50' },
  ], error: null })
  assert.equal(description, 'free on orders of £45.50 or more, otherwise £2.50 per order')
  await assert.rejects(policy({ data: null, error: { message: 'Private failure' } }), /Unable to load delivery charges/)
})

test('shipping descriptions agree with checkout for zero charges, disabled offers and inclusive thresholds', () => {
  for (const input of [{ shipping_rate: '0', free_shipping_enabled: false }, { free_shipping_threshold: '0' }]) {
    const settings = pricing.shippingSettingsFromApi(input)
    assert.equal(pricing.shippingDescription(settings), 'free')
    assert.equal(pricing.calculateTotals('1', settings).shipping, '0.00')
  }
  const disabled = pricing.shippingSettingsFromApi({ shipping_rate: '2.50', free_shipping_enabled: 'false' })
  assert.equal(pricing.shippingDescription(disabled), '£2.50 per order')
  const decimal = pricing.shippingSettingsFromApi({ free_shipping_threshold: '45.50' })
  assert.match(pricing.shippingDescription(decimal), /£45.50 or more/)
  assert.equal(pricing.calculateTotals('45.49', decimal).shipping, '3.95')
  assert.equal(pricing.calculateTotals('45.50', decimal).shipping, '0.00')
  assert.match(pricing.shippingDescription(pricing.shippingSettingsFromApi({ shipping_rate: 'invalid' })), /£3.95/)
})

function productSettings(result) {
  const source = read('app/collections/[slug]/[productSlug]/page.jsx')
  const start = source.indexOf('const getSettings = cache')
  const loader = source.slice(start, source.indexOf('\n})', start) + 3)
  return compile(loader, { ...pricing, cache: fn => fn, supabaseServer: database(() => {
    if (result instanceof Error) throw result
    return result
  }) }, 'getSettings')()
}

test('product shipping failures return unknown rather than a false free-shipping offer', async () => {
  assert.equal(await productSettings({ data: null, error: { message: 'Unavailable' } }), null)
  assert.equal(await productSettings(Error('Network unavailable')), null)
  const settings = await productSettings({ data: [{ key: 'shipping_rate', value: '2.50' }], error: null })
  assert.equal(settings.shippingRate, '2.50')
  const source = read('app/collections/[slug]/[productSlug]/page.jsx')
  const block = source.slice(source.indexOf('const shippingDetails ='), source.indexOf('  // Do not invent'))
  const details = settings => compile(block, { settings, SITE_ORIGIN: 'https://example.test' }, 'shippingDetails')
  assert.equal(details(null), undefined)
  assert.equal(details(settings).shippingRate.value, '2.50')
  assert.equal(details(pricing.shippingSettingsFromApi({ free_shipping_threshold: '0' })).shippingRate.value, '0.00')
})

function shippingHook(fetch, initialSettings = null) {
  const states = [], effects = [], timers = new Map()
  let index = 0
  const run = compile(read('lib/use-shipping-settings.js'), {
    ...pricing, fetch, AbortController,
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    },
    useCallback: fn => fn, useEffect: fn => effects.push(fn),
    setTimeout: fn => { const id = {}; timers.set(id, fn); return id },
    clearTimeout: id => timers.delete(id),
  }, 'useShippingSettings')
  return { states, timers,
    render() { index = 0; effects.length = 0; return run(initialSettings) },
    start() { return effects[0]() },
  }
}

test('a successful server snapshot renders without another request or guessed defaults', () => {
  const initial = pricing.shippingSettingsFromApi({ shipping_rate: '0', free_shipping_enabled: false })
  const h = shippingHook(() => { throw Error('Unnecessary request') }, initial)
  assert.deepEqual(h.render().settings, initial)
  h.start()
  assert.equal(h.states[1], false)
  assert.equal(h.timers.size, 0)
})

test('delivery HTTP failures stay unknown and retry can recover exact settings', async () => {
  let calls = 0
  const h = shippingHook(async (url, options) => {
    assert.equal(url, '/api/settings')
    assert.equal(options.cache, 'no-store')
    return ++calls === 1 ? Response.json({ error: 'Private details' }, { status: 503 })
      : Response.json({ shipping_rate: '2.50', free_shipping_threshold: '45.50' })
  })
  const actions = h.render()
  assert.equal(actions.settings, null)
  const cleanup = h.start()
  await flush()
  assert.equal(h.states[0], null)
  assert.equal(h.states[1], true)
  cleanup()
  actions.retry()
  h.render(); h.start()
  await flush()
  assert.equal(h.states[0].shippingRate, '2.50')
  assert.equal(h.states[0].freeShippingThreshold, '45.50')
  assert.equal(h.states[1], false)
  assert.equal(h.timers.size, 0)
})

test('stalled delivery requests time out and cancelled responses cannot overwrite a retry', async () => {
  const pending = []
  const h = shippingHook(() => new Promise(resolve => pending.push(resolve)))
  const actions = h.render()
  const cleanup = h.start()
  ;[...h.timers.values()][0]()
  assert.equal(h.states[1], true)
  assert.equal(h.states[0], null)
  cleanup()
  actions.retry()
  h.render(); const cancel = h.start()
  pending[1](Response.json({ shipping_rate: '2.50' }))
  await flush()
  pending[0](Response.json({ shipping_rate: '99' }))
  await flush()
  assert.equal(h.states[0].shippingRate, '2.50')
  assert.equal(h.states[1], false)
  cancel()
  assert.equal(h.timers.size, 0)
})

test('leaving the product page prevents aborted requests from changing state', async () => {
  const h = shippingHook((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Error('Aborted')))
  }))
  h.render(); const cleanup = h.start()
  cleanup()
  await flush()
  assert.equal(h.states[0], null)
  assert.equal(h.states[1], false)
  assert.equal(h.timers.size, 0)
})
