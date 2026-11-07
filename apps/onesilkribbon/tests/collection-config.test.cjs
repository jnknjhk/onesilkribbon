const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const source = read('lib/collections.js').replace(/^export /gm, '')
const { COLLECTIONS, COLLECTION_SLUGS, COLLECTION_META } = new Function(
  source + ';return {COLLECTIONS,COLLECTION_SLUGS,COLLECTION_META}'
)()

test('the collection directory has one unique entry per published collection', () => {
  assert.ok(COLLECTIONS.length >= 6)
  assert.equal(new Set(COLLECTION_SLUGS).size, COLLECTIONS.length)
  assert.deepEqual(Object.keys(COLLECTION_META), COLLECTION_SLUGS)
  for (const collection of COLLECTIONS) {
    for (const key of ['slug', 'label', 'name', 'desc', 'bg']) assert.ok(collection[key], `${collection.slug}.${key}`)
    assert.ok(Array.isArray(collection.guidance))
  }
})

test('admin dropdown and image slots derive from the same collection directory', () => {
  const siteSource = read('admin/site-config.js')
    .replace(/^import .*$/gm, '')
    .replace(/^export /gm, '')
  const siteConfig = new Function('COLLECTIONS', siteSource + ';return siteConfig')(COLLECTIONS)
  assert.deepEqual(siteConfig.collections, COLLECTIONS.map(({ slug, label }) => ({ value: slug, label })))

  const keys = siteConfig.imageSlots.flatMap(slot => slot.keys.map(item => item.key))
  for (const slug of COLLECTION_SLUGS) {
    assert.ok(keys.includes(`home_col_${slug}`), `home_col_${slug}`)
    assert.ok(keys.includes(`hero_${slug}`), `hero_${slug}`)
  }
})

test('storefront and home page consume the shared directory instead of local lists', () => {
  assert.match(read('app/page.jsx'), /COLLECTION_SLUGS.*@\/lib\/collections/)
  assert.doesNotMatch(read('app/page.jsx'), /const COLLECTION_SLUGS = \[/)
  assert.match(read('app/HomeClient.jsx'), /COLLECTIONS.*@\/lib\/collections/)
  assert.doesNotMatch(read('app/HomeClient.jsx'), /const COLLECTIONS = \[/)
  assert.match(read('admin/site-config.js'), /COLLECTIONS\.map/)
})
