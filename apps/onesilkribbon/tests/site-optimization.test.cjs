const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

test('sitemap keeps real dates and rejects a database outage instead of silently dropping URLs', async () => {
  let failed = false
  globalThis.__sitemapDb = { from: table => ({ select: () => ({ eq: async () => failed
    ? { data: null, error: { message: 'private database failure' } }
    : { data: table === 'products'
      ? [{ slug: 'ribbon', collection: 'silk', updated_at: '2026-01-02' }, { slug: 'bow', collection: 'silk', updated_at: 'invalid' }]
      : [{ slug: 'story', updated_at: null }] } }) }) }
  try {
    const { default: sitemap } = await load(read('app/sitemap.js').replace("import { supabaseAdmin } from '@osr/core/lib/supabase'", 'const supabaseAdmin = globalThis.__sitemapDb'))
    const result = await sitemap()
    assert.equal(result.find(row => row.url.endsWith('/silk/ribbon')).lastModified.toISOString(), '2026-01-02T00:00:00.000Z')
    assert.ok(result.some(row => row.url.endsWith('/journal/story')))
    assert.equal(result.filter(row => row.url.endsWith('/collections/silk')).length, 1)
    assert.equal(result.filter(row => row.lastModified).length, 1)
    failed = true
    await assert.rejects(sitemap, /Unable to generate sitemap/)
  } finally { delete globalThis.__sitemapDb }
})

test('shipping parsing preserves free/zero thresholds and never turns invalid data into free delivery', async () => {
  const { shippingSettingsFromApi, calculateTotals } = await load(read('lib/pricing.js'))
  for (const input of [{}, null, { shipping_rate: 'invalid', free_shipping_threshold: -1 }, { shipping_rate: 'NaN', free_shipping_threshold: '' }]) {
    const settings = shippingSettingsFromApi(input)
    assert.equal(calculateTotals(5, settings).shipping, '3.95')
    assert.equal(Number(settings.freeShippingThreshold), 45)
  }
  assert.equal(calculateTotals(5, shippingSettingsFromApi({ shipping_rate: '0', free_shipping_enabled: false })).shipping, '0.00')
  assert.equal(calculateTotals(5, shippingSettingsFromApi({ free_shipping_threshold: '0' })).freeShipping, true)
  assert.equal(Number(shippingSettingsFromApi({ free_shipping_threshold: '45.50' }).freeShippingThreshold), 45.5)
})

test('overlapping menu and basket locks preserve the initial body style until the last close', () => {
  let effect
  const context = vm.createContext({ document: { body: { style: { overflow: 'clip' } } }, useEffect: callback => { effect = callback } })
  vm.runInContext(read('lib/use-body-scroll-lock.js').replace(/^import .*$/gm, '').replace('export function', 'function'), context)
  context.useBodyScrollLock(true)
  const first = effect()
  context.useBodyScrollLock(true)
  const second = effect()
  first()
  assert.equal(context.document.body.style.overflow, 'hidden')
  second()
  assert.equal(context.document.body.style.overflow, 'clip')
})

test('search cancels timers and ignores late results from an obsolete query', async () => {
  const state = [false, false, true, 'silk', [], false, false]
  const effects = []
  const timers = new Map()
  const pending = []
  let index = 0
  const context = vm.createContext({
    useState: () => { const slot = index++; return [state[slot], value => { state[slot] = value }] },
    useRef: () => ({ current: null }), useEffect: (callback, deps) => { effects.push({ callback, deps }) },
    useBodyScrollLock() {}, usePathname: () => '/', useRouter: () => ({}),
    useCart: () => ({}), useAuth: () => ({}), AbortController, encodeURIComponent,
    setTimeout: callback => { const id = {}; timers.set(id, callback); return id }, clearTimeout: id => timers.delete(id),
    fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })),
  })
  const source = read('components/Navbar.jsx').split('\n  return (')[0].replace(/^import .*$/gm, '').replace('export function Navbar', 'function Navbar') + '\n}'
  vm.runInContext(source, context)
  context.Navbar()
  const search = effects.find(effect => effect.deps?.[0] === 'silk').callback
  const cleanup = search()
  const callback = [...timers.values()][0]
  const request = callback()
  cleanup()
  assert.equal(pending[0].options.signal.aborted, true)
  state[4] = [{ id: 'newer-result' }]
  pending[0].resolve({ ok: true, json: async () => [{ id: 'obsolete-result' }] })
  await request
  assert.equal(state[4][0].id, 'newer-result')
  assert.equal(timers.size, 0)
  state[3] = ''
  index = 0
  effects.length = 0
  context.Navbar()
  effects.find(effect => effect.deps?.[0] === '').callback()
  assert.equal(state[5], false)
  assert.equal(state[4].length, 0)
})

test('cookie auth delegates chunk/base64 decoding to SSR and verifies the token with the auth server', async () => {
  const { createServerClient } = require('@supabase/ssr')
  const session = { access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'verified-user' } }
  const encoded = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  const calls = []
  globalThis.__authFactory = (_url, _key, options) => createServerClient('https://test-project.supabase.co', 'test-public', {
    ...options, global: { fetch: async (url, options) => {
      calls.push({ url, options })
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer test-access')
      return Response.json({ id: 'verified-user', email: 'test@example.com' })
    } },
  })
  globalThis.__authAdmin = { auth: { getUser: async () => ({ data: { user: null }, error: true }) } }
  try {
    const source = fs.readFileSync(path.resolve(root, '../../packages/core/lib/get-auth-user.js'), 'utf8')
      .replace("import { supabaseAdmin } from './supabase'", 'const supabaseAdmin = globalThis.__authAdmin')
      .replace("import { createServerClient } from '@supabase/ssr'", 'const createServerClient = globalThis.__authFactory')
    const { getAuthUser } = await load(source)
    const cookie = `sb-test-project-auth-token.0=${encoded.slice(0, 80)}; sb-test-project-auth-token.1=${encoded.slice(80)}`
    const user = await getAuthUser(new Request('https://example.com', { headers: { cookie } }))
    assert.equal(user.id, 'verified-user')
    assert.equal(calls.length, 1)
    assert.equal(await getAuthUser(new Request('https://example.com', { headers: { cookie, authorization: 'Bearer invalid' } })), null)
    assert.equal(calls.length, 1)
    assert.equal(await getAuthUser(new Request('https://example.com')), null)
  } finally { delete globalThis.__authFactory; delete globalThis.__authAdmin }
})

test('homepage only prices active variants and product selection has no delayed SKU state', () => {
  assert.match(read('app/page.jsx'), /\.in\('product_id', productIds\)\s*\.eq\('is_active', true\)/)
  const product = read('app/collections/[slug]/[productSlug]/ProductClient.jsx')
  assert.match(product, /const selectedSku = matchSku\(/)
  assert.doesNotMatch(product, /setSelectedSku/)
  const home = read('app/HomeClient.jsx')
  assert.match(home, /return \(\) => \{ obs.disconnect\(\)/)
  assert.doesNotMatch(home, /\.reveal \{ opacity: 0/)
})

test('checkout cannot show a payable fallback total before delivery settings load', () => {
  const checkout = read('app/checkout/page.jsx')
  assert.match(checkout, /if \(loading \|\| !shippingSettings \|\| !validate\(\)\) return/)
  assert.match(checkout, /disabled=\{loading \|\| !shippingSettings\}/)
  assert.match(checkout, /setShippingError\(/)
  assert.match(checkout, /paymentRequestError && <p role="alert"/)
  assert.match(read('components/CartDrawer.jsx'), /label="Total" value=\{!shippingSettings \? 'Calculating…'/)
})
