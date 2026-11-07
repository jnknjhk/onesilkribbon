const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const load = (file, name) => {
  const source = read(file).replace(/^import .*$/gm, '').replace(/^export /gm, '')
  return new Function(source + `;return ${name}`)()
}

test('storefront and admin use the same order status keys, without processing', () => {
  const storefront = load('lib/order-status.js', '{ ORDER_STATUS, ACTIVE_ORDER_STATUSES, TRACKABLE_ORDER_STATUSES }')
  const admin = load('admin/lib/status.js', 'ORDER_STATUS')
  const expected = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded']
  assert.deepEqual(Object.keys(storefront.ORDER_STATUS).sort(), [...expected].sort())
  assert.deepEqual(Object.keys(admin).sort(), [...expected].sort())
  assert.deepEqual(storefront.ACTIVE_ORDER_STATUSES, ['paid', 'shipped'])
  assert.deepEqual(storefront.TRACKABLE_ORDER_STATUSES, ['paid', 'shipped', 'delivered'])
})

test('account pages use the shared badge and no local processing status', () => {
  for (const file of [
    'app/account/page.jsx',
    'app/account/orders/page.jsx',
    'app/account/orders/[id]/page.jsx',
  ]) {
    const source = read(file)
    assert.match(source, /@\/components\/OrderStatusBadge/, file)
    assert.doesNotMatch(source, /STATUS_LABEL|STATUS_COLOR/, file)
    assert.doesNotMatch(source, /processing/, file)
  }
})

test('Next leftover config is gone and shipping defaults have one source', () => {
  assert.doesNotMatch(read('next.config.js'), /serverActions|allowedOrigins/)
  const pricingSource = read('lib/order-pricing.js')
  assert.match(pricingSource, /SHIPPING_RATE, FREE_SHIPPING_THRESHOLD/)
  assert.doesNotMatch(pricingSource, /\?\?\s*3\.95|\?\?\s*45\b/)
  assert.match(read('app/page.jsx'), /FREE_SHIPPING_THRESHOLD/)
  assert.match(read('app/HomeClient.jsx'), /FREE_SHIPPING_THRESHOLD/)
})
