const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '../app/products/[slug]/page.jsx'), 'utf8')
const current = { slug: '2mm-mulberry-silk-ribbon', collection: 'fine-silk-ribbons', is_active: true }

function harness({ products = [current], moved = {}, failSlug } = {}) {
  const queries = []
  const supabaseServer = { from(table) {
    assert.equal(table, 'products')
    const filters = {}
    return {
      select() { return this },
      eq(key, value) { filters[key] = value; return this },
      async maybeSingle() {
        queries.push({ ...filters })
        if (filters.slug === failSlug) return { data: null, error: { message: 'Database unavailable' } }
        return { data: products.find(p => Object.entries(filters).every(([key, value]) => p[key] === value)) || null, error: null }
      },
    }
  } }
  const render = new Function('supabaseServer', 'permanentRedirect', 'notFound', 'findRenamedProduct',
    source.replace(/^import .*\r?\n/gm, '').replace(/^export const /gm, 'const ').replace('export default async function', 'async function') + '\nreturn LegacyProductRedirect',
  )(
    supabaseServer,
    target => { throw Object.assign(new Error('Redirect'), { target }) },
    () => { throw Object.assign(new Error('Not found'), { notFound: true }) },
    async (_db, slug) => Object.hasOwn(moved, slug) ? moved[slug] : null,
  )
  return { render, queries }
}

test('confirmed 4mm and 7mm Shopify URLs redirect to the consolidated product without obsolete parameters', async () => {
  for (const width of [4, 7]) {
    const { render, queries } = harness()
    await assert.rejects(render({
      params: Promise.resolve({ slug: `${width}mm-mulberry-silk-ribbon` }),
      searchParams: Promise.resolve({ variant: width === 4 ? '44919945461807' : '44919957618735', country: 'DE', currency: 'GBP' }),
    }), error => error.target === '/collections/fine-silk-ribbons/2mm-mulberry-silk-ribbon')
    assert.ok(queries.every(query => query.is_active === true))
  }
})

test('an exact active product wins over the historical alias and uses its actual collection', async () => {
  const exact = { slug: '4mm-mulberry-silk-ribbon', collection: 'another-collection', is_active: true }
  const { render, queries } = harness({ products: [current, exact] })
  await assert.rejects(render({ params: { slug: exact.slug } }), error => error.target === '/collections/another-collection/4mm-mulberry-silk-ribbon')
  assert.equal(queries.length, 1)
})

test('aliases follow the consolidated product if it has subsequently been renamed', async () => {
  const { render } = harness({ products: [], moved: { [current.slug]: { slug: 'fine-silk-spool', collection: 'fine-silk-ribbons' } } })
  await assert.rejects(render({ params: { slug: '7mm-mulberry-silk-ribbon' } }), error => error.target === '/collections/fine-silk-ribbons/fine-silk-spool')
})

test('unknown slugs, absent alias targets and inactive products remain not found', async () => {
  for (const [slug, products] of [
    ['unknown-ribbon', [current]],
    ['constructor', [current]],
    ['toString', [current]],
    ['13mm-mulberry-silk-ribbon', [current]],
    ['4mm-mulberry-silk-ribbon', []],
    ['7mm-mulberry-silk-ribbon', [{ ...current, is_active: false }]],
  ]) {
    const { render } = harness({ products })
    await assert.rejects(render({ params: { slug } }), error => error.notFound === true)
  }
})

test('database failures do not turn legacy products into false 404 responses', async () => {
  for (const failSlug of ['4mm-mulberry-silk-ribbon', current.slug]) {
    const { render } = harness({ failSlug })
    await assert.rejects(render({ params: { slug: '4mm-mulberry-silk-ribbon' } }), /Unable to resolve product redirect/)
  }
})

test('existing exact and renamed product redirects remain available', async () => {
  const exact = harness()
  await assert.rejects(exact.render({ params: { slug: current.slug } }), error => error.target === '/collections/fine-silk-ribbons/2mm-mulberry-silk-ribbon')
  const renamed = harness({ products: [], moved: { espresso: { slug: 'espresso-brown', collection: 'hand-frayed-silk-ribbons' } } })
  await assert.rejects(renamed.render({ params: { slug: 'espresso' } }), error => error.target === '/collections/hand-frayed-silk-ribbons/espresso-brown')
})
