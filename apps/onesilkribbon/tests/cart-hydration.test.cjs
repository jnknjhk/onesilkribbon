const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { create } = require('zustand')
const { persist } = require('zustand/middleware')
const source = fs.readFileSync(path.join(__dirname, '../lib/cart.js'), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const makeCart = () => new Function('create', 'persist', source + ';return useCart')(create, persist)
const item = { skuId: 'test-sku', productId: 'test-product', name: 'Test silk', qty: 2, price: 9 }
function withStorage(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map([['osr-cart', JSON.stringify({ state: { items: [item], isOpen: true }, version: 1 })]])
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } })
  return Promise.resolve().then(() => run(values)).finally(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  })
}

test('saved baskets restore after initial render without opening old overlays or losing items', () => withStorage(async () => {
  const cart = makeCart()
  assert.deepEqual(cart.getState().items, [])
  assert.equal(cart.persist.hasHydrated(), false)
  assert.equal(cart.getState().isOpen, false)
  await cart.persist.rehydrate()
  assert.deepEqual(cart.getState().items, [item])
  assert.equal(cart.getState().isOpen, false)
  assert.equal(cart.getState().getItemCount(), 2)
  assert.equal(cart.getState().getSubtotal(), 18)
}))

test('basket changes still persist across reloads while drawer state stays transient', () => withStorage(async values => {
  const cart = makeCart()
  await cart.persist.rehydrate()
  cart.getState().updateQty(item.skuId, 3)
  cart.getState().openCart()
  const saved = JSON.parse(values.get('osr-cart'))
  assert.equal(saved.state.items[0].qty, 3)
  assert.equal(saved.state.isOpen, undefined)
  assert.equal(saved.version, 1)
  const restored = makeCart()
  await restored.persist.rehydrate()
  assert.equal(restored.getState().items[0].qty, 3)
  assert.equal(restored.getState().isOpen, false)
  restored.getState().addItem({ ...item, qty: 1 })
  assert.equal(restored.getState().items[0].qty, 4)
  assert.equal(restored.getState().isOpen, true)
}))
