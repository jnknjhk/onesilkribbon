// Read-only migration smoke checks. No checkout creation, capture, refund,
// subscription, account modification, or email request is ever submitted.
const assert = require('node:assert/strict')
const base = new URL(process.argv[2] || 'http://localhost:3107')
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
  throw new Error('Expected a plain site origin')
}
const results = []
async function get(path, expected = 200, headers = {}) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', headers, signal: AbortSignal.timeout(45000) })
  assert.equal(response.status, expected, `${path}: unexpected HTTP status`)
  results.push({ path: path.split('?')[0], status: response.status })
  return response
}
async function page(path) {
  const response = await get(path)
  const text = await response.text()
  assert.match(response.headers.get('content-type'), /text\/html/)
  assert.doesNotMatch(text, /Something went wrong|NEXT_HTTP_ERROR_FALLBACK;500/)
  return text
}
async function main() {
  const home = await page('/')
  assert.match(home, /data-scroll-behavior="smooth"/, 'Retain instant route navigation with global smooth scrolling')
  for (const path of ['/collections', '/ribbon-guide', '/contact', '/login', '/admin-login', '/account/reset-password', '/checkout', '/order-confirmed', '/track-order']) await page(path)
  const sitemap = await (await get('/sitemap.xml')).text()
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]))
  const product = locations.find(url => /^\/collections\/[^/]+\/[^/]+$/.test(url.pathname))
  assert.ok(product, 'Sitemap must contain a published product')
  await page(product.pathname)
  await page(product.pathname.split('/').slice(0, 3).join('/'))
  const journal = locations.find(url => /^\/journal\/[^/]+$/.test(url.pathname))
  if (journal) await page(journal.pathname)
  const feed = await (await get('/api/google-feed')).text()
  assert.match(feed, /<rss[\s>]/)
  assert.match(feed, /<item>/)
  const settings = await (await get('/api/settings')).json()
  assert.ok(Number.isFinite(Number(settings.shipping_rate)))
  const search = await (await get('/api/search?q=silk')).json()
  assert.ok(Array.isArray(search) && search.length > 0)
  const forged = { 'x-osr-admin-email': (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || 'admin@example.test' }
  for (const path of ['/api/admin/products', '/api/admin/orders', '/api/admin/settings', '/api/admin/stock', '/api/admin/products/fake.png', '/api/user/orders', '/api/user/addresses', '/api/user/profile']) {
    await get(path, 401, forged)
  }
  const deniedPage = await get('/admin/products', 307, forged)
  assert.equal(new URL(deniedPage.headers.get('location'), base).pathname, '/admin-login')
  await get('/api/order-status?order=OSR-FRAMEWORK-CHECK', 400)
  await get('/api/payment-confirmation', 400)
  await get('/api/paypal/capture', 400)
  const callback = await get('/api/auth/callback', 307)
  assert.equal(new URL(callback.headers.get('location'), base).pathname, '/login')
  const legacy = await get('/order-confirmed?order=OSR-FRAMEWORK-CHECK&proof=test-only-proof', 307)
  assert.equal(new URL(legacy.headers.get('location'), base).pathname, '/api/payment-confirmation')
  const imagePaths = [...home.matchAll(/src="([^"\s]*\/_next\/image\?[^"\s]+)"/g)].map(match => match[1].replace(/&amp;/g, '&'))
  assert.ok(imagePaths.length, 'Expected an optimized homepage image')
  const remoteImage = imagePaths.find(value => /^https:\/\//.test(new URL(value, base).searchParams.get('url') || ''))
  assert.ok(remoteImage, 'Expected an optimized remote catalog image as well as the logo')
  for (const value of new Set([imagePaths[0], remoteImage])) {
    const image = await get(value, 200, { accept: 'image/avif,image/webp,image/*' })
    assert.match(image.headers.get('content-type'), /^image\/(avif|webp|png|jpeg)/)
    assert.ok((await image.arrayBuffer()).byteLength > 0)
  }
  console.log(JSON.stringify({ origin: base.origin, passed: results.length, checks: results }, null, 2))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
