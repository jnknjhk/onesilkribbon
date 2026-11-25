const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')

test('only the configured admin can access internal product names', async () => {
  const { canAccessInternalProductNames } = await import('../admin/lib/internal-product-names.js')
  const ownerHash = createHash('sha256').update('owner@example.test').digest('hex')
  const db = {
    from(table) {
      assert.equal(table, 'product_internal_name_access')
      return { select: () => ({
        eq(column, value) {
          assert.equal(column, 'owner_email_hash')
          return { maybeSingle: async () => ({ data: value === ownerHash ? { id: true } : null }) }
        },
      }) }
    },
  }
  assert.equal(await canAccessInternalProductNames(db, { email: 'Owner@EXAMPLE.test' }), true)
  assert.equal(await canAccessInternalProductNames(db, { email: 'other-admin@example.test' }), false)
  assert.equal(await canAccessInternalProductNames(db, null), false)
  const failed = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: new Error('Unavailable') }) }) }) }) }
  assert.equal(await canAccessInternalProductNames(failed, { email: 'owner@example.test' }), false)
})

test('packing names resolve direct products and pre-split orders through their SKU', async () => {
  const { attachInternalPackingNames } = await import('../admin/lib/internal-product-names.js')
  const current = { product_id: 'colour-a', sku_id: 'new-sku', product_name: 'Light Pink', sku_description: '4mm', quantity: 2 }
  const legacy = { product_id: 'legacy', sku_id: 'old-sku', product_name: 'Fine Silk', sku_description: 'Soft Pink · 7mm', quantity: 3 }
  const unrelated = { product_id: 'other', product_name: 'Other product', sku_description: 'Default', quantity: 1 }
  const records = {
    product_skus: [{ id: 'old-sku', product_id: 'colour-b' }],
    product_internal_names: [{ product_id: 'colour-a', internal_name: '浅粉' }, { product_id: 'colour-b', internal_name: '淡粉' }],
  }
  const db = { from: table => ({ select: () => ({ in: async () => ({ data: records[table] }) }) }) }
  assert.deepEqual(await attachInternalPackingNames(db, [current, legacy, unrelated]), [
    { ...current, internal_name: '浅粉', packing_width: '4 mm' },
    { ...legacy, internal_name: '淡粉', packing_width: '7 mm' },
    unrelated,
  ])
})
