const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('catalog, site-image and settings writes invalidate the ISR paths they affect', () => {
  const calls = []
  const source = read('admin/lib/revalidate.js').replace(/^import .*$/gm, '').replace(/^export /gm, '')
  const f = new Function('revalidatePath', source + ';return {revalidateCatalog,revalidateSiteImages,revalidateSettings}')(
    (...args) => calls.push(args)
  )
  f.revalidateCatalog()
  assert.deepEqual(calls, [
    ['/'], ['/collections'], ['/collections/[slug]', 'page'],
    ['/collections/[slug]/[productSlug]', 'page'], ['/sitemap.xml'], ['/api/google-feed'],
  ])
  calls.length = 0
  f.revalidateSiteImages()
  assert.deepEqual(calls, [
    ['/'], ['/about'], ['/collections'],
    ['/collections/[slug]', 'page'], ['/collections/[slug]/[productSlug]', 'page'],
  ])
  calls.length = 0
  f.revalidateSettings()
  assert.deepEqual(calls, [['/'], ['/collections/[slug]/[productSlug]', 'page']])
})

test('product, site-image, settings and journal writes call revalidation', () => {
  assert.match(read('admin/api/products.js'), /revalidateCatalog\(\)/)
  assert.match(read('admin/api/site-images.js'), /revalidateSiteImages\(\)/)
  assert.match(read('admin/api/settings.js'), /revalidateSettings\(\)/)
  assert.match(read('admin/api/journal.js'), /revalidatePath\('\/'\)/)
})
