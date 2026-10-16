const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const attack = '<img src=x onerror="alert(1)"> & \'test\''

function emailHarness() {
  const sent = []
  const logs = []
  const context = vm.createContext({
    URL, process: { env: {} },
    logEmail: async entry => { logs.push(entry) },
    // No network API is exposed: all deliveries are captured here.
    fetch: async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails')
      sent.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ id: 'mock-email' }) }
    },
  })
  const escapeSource = fs.readFileSync(path.resolve(root, '../../packages/core/lib/escape-html.js'), 'utf8')
  vm.runInContext(escapeSource.replace('export function', 'function'), context)
  vm.runInContext(read('lib/email.js').replace(/^import .*$/gm, '').replace(/export async function/g, 'async function'), context)
  return { context, sent, logs, escape: context.escapeHtml }
}

function fixture() {
  return {
    order: { order_number: attack, created_at: '2026-10-01', shipping_name: attack, customer_email: `buyer+"&@example.com` },
    items: [{ name: attack, skuDesc: attack, qty: attack, price: 3 }],
    form: Object.fromEntries(['firstName', 'lastName', 'line1', 'line2', 'city', 'postcode', 'country', 'dialCode', 'phone', 'email'].map(key => [key, attack])),
    totals: { subtotal: attack, shipping: attack, total: attack, discount: attack },
  }
}

test('confirmation and owner email escape every supplied HTML field and preserve recipients', async () => {
  const { context, sent, logs, escape } = emailHarness()
  const input = fixture()
  await context.sendOrderConfirmation(input)
  await context.sendOwnerNotification(input)
  assert.equal(sent[0].to, input.form.email)
  assert.equal(sent[1].to, 'song@onesilkribbon.com')
  assert.equal(logs[0].to, input.form.email)
  for (const email of sent) {
    assert.ok(!email.html.includes(attack))
    assert.ok(email.html.includes(escape(attack)))
    assert.ok(email.html.includes(`<span>Discount</span><span>−£${escape(attack)}</span>`))
    assert.ok(email.html.includes(escape(encodeURIComponent(input.order.order_number))))
    assert.ok(!email.html.includes('<img'))
  }
  assert.ok(sent[1].html.includes(`href="mailto:${escape(input.form.email)}"`))
  assert.ok(sent[0].subject.includes(input.order.order_number))
})

test('discount is rendered when present, including zero, and omitted when absent', async () => {
  const { context, sent } = emailHarness()
  for (const discount of [undefined, null, 0, '2.50']) {
    const input = fixture()
    input.totals.discount = discount
    await context.sendOrderConfirmation(input)
    await context.sendOwnerNotification(input)
    for (const email of sent.slice(-2)) {
      assert.equal(email.html.includes('<span>Discount</span>'), discount != null)
      if (discount != null) assert.ok(email.html.includes(`−£${discount}`))
    }
  }
})

test('shipping email escapes text and accepts only HTTPS tracking links without credentials', async () => {
  const { context, sent, escape } = emailHarness()
  const { order } = fixture()
  const valid = 'https://courier.example/track?number=123&note="test"'
  await context.sendShippingNotification({ order, trackingNumber: attack, carrier: attack, trackingUrl: valid })
  const email = sent.at(-1)
  assert.equal(email.to, order.customer_email)
  assert.ok(!email.html.includes(attack))
  assert.ok(email.html.includes(escape(attack)))
  assert.ok(email.html.includes(`href="${escape(new URL(valid).href)}"`))
  assert.ok(!email.html.includes('<img'))
  for (const trackingUrl of [
    'javascript:alert(1)', 'data:text/html,bad', 'http://courier.example',
    '//courier.example', '/tracking', 'https://user:pass@courier.example',
    'https://user@courier.example', 'https://:pass@courier.example',
    'https://', 'https://courier.example/" onclick="alert(1)',
    ' https://courier.example', 'https://courier.example\n.evil',
    'https:\\courier.example', null, {},
  ]) {
    await context.sendShippingNotification({ order, trackingNumber: attack, carrier: attack, trackingUrl })
    assert.ok(!sent.at(-1).html.includes('Track Your Parcel'), String(trackingUrl))
  }
})

test('safeJsonLd prevents script termination and escapes Unicode separators without data loss', () => {
  const context = vm.createContext({})
  vm.runInContext(read('lib/safe-json-ld.js').replace('export function', 'function'), context)
  const value = { title: '</script><script>alert("x")</script>', nested: ['<>&', '\u2028\u2029', null, 42] }
  const json = context.safeJsonLd(value)
  assert.doesNotMatch(json, /[<\u2028\u2029]/)
  assert.ok(json.includes('\\u003c/script>'))
  assert.ok(json.includes('\\u2028\\u2029'))
  assert.deepEqual(JSON.parse(json), value)
})

test('journal and collection JSON-LD scripts use the shared safe serializer', () => {
  for (const file of ['app/journal/[slug]/page.jsx', 'app/collections/[slug]/page.jsx']) {
    const source = read(file)
    assert.match(source, /import \{ safeJsonLd \} from '@\/lib\/safe-json-ld'/)
    assert.match(source, /__html: safeJsonLd\(jsonLd\)/)
    assert.doesNotMatch(source, /__html: JSON\.stringify\(jsonLd\)/)
  }
})
