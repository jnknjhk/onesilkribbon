const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { NextRequest, NextResponse } = require('next/server')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const core = file => fs.readFileSync(path.resolve(root, '../../packages/core', file), 'utf8')
const compile = (source, bindings, names) => new Function(...Object.keys(bindings),
  source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `; return {${names}}`
)(...Object.values(bindings))
const ADMIN_HEADER = 'x-osr-admin-email'

function middlewareHarness(user = null, refresh = false) {
  let calls = 0
  const { adminMiddleware } = compile(core('lib/admin-middleware.js'), {
    NextResponse, ADMIN_HEADER, isAdminEmail: email => email === 'admin@example.test',
    createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
      calls++
      if (refresh) options.cookies.setAll([{ name: 'test-session', value: 'refreshed', options: { httpOnly: true, sameSite: 'lax', path: '/' } }])
      return { data: { user }, error: null }
    } } }),
  }, 'adminMiddleware')
  const run = pathname => adminMiddleware(new NextRequest('https://onesilkribbon.com' + pathname, {
    headers: { [ADMIN_HEADER]: 'admin@example.test', cookie: 'test-session=old' },
  }))
  return { run, calls: () => calls }
}

test('Next 16 is installed and scripts keep Webpack while running lint separately', () => {
  const manifest = JSON.parse(read('package.json'))
  assert.match(require('next/package.json').version, /^16\./)
  assert.match(manifest.scripts.build, /next build --webpack/)
  assert.doesNotMatch(manifest.scripts.lint, /next lint/)
  assert.match(manifest.scripts.lint, /--ext \.js,\.jsx/)
  assert.equal(manifest.engines.node, '24.x')
  assert.equal(JSON.parse(fs.readFileSync(path.resolve(root, '../../package.json'), 'utf8')).engines.node, '24.x')
  assert.ok(!fs.existsSync(path.join(root, 'sentry.client.config.js')))
  assert.match(read('instrumentation-client.js'), /onRouterTransitionStart = Sentry.captureRouterTransitionStart/)
  assert.match(read('app/layout.jsx'), /<html[^>]*data-scroll-behavior="smooth"/)
})

test('Next 16 middleware removes spoofed admin headers on every public route without auth calls', async () => {
  const h = middlewareHarness()
  for (const route of ['/', '/admin-login', '/api/settings', '/api/email', '/api/payment-confirmation']) {
    const response = await h.run(route)
    assert.equal(response.status, 200)
    assert.equal(response.headers.has(`x-middleware-request-${ADMIN_HEADER}`), false)
  }
  assert.equal(h.calls(), 0)
  assert.match(read('middleware.js'), /matcher: \['\/\(\(\?!_next\/static\|_next\/image\)\.\*\)'\]/)
})

test('anonymous or non-admin users cannot enter admin APIs even with a forged admin header', async () => {
  for (const user of [null, { email: 'buyer@example.test' }]) {
    const h = middlewareHarness(user)
    for (const route of ['/api/admin', '/api/admin/products', '/api/admin/products/fake.png']) {
      const response = await h.run(route)
      assert.equal(response.status, 401)
      assert.deepEqual(await response.json(), { error: 'Unauthorized' })
      assert.equal(response.headers.has(`x-middleware-request-${ADMIN_HEADER}`), false)
    }
  }
})

test('verified admin identity and refreshed cookies survive Next 16 request forwarding', async () => {
  const h = middlewareHarness({ email: 'admin@example.test' }, true)
  const response = await h.run('/api/admin/products')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get(`x-middleware-request-${ADMIN_HEADER}`), 'admin@example.test')
  assert.match(response.headers.get('x-middleware-request-cookie'), /test-session=refreshed/)
  assert.equal(response.cookies.get('test-session').value, 'refreshed')
  assert.match(response.headers.get('set-cookie'), /HttpOnly/)
  assert.equal(h.calls(), 1)
})

test('refresh cookies survive denied APIs and redirected admin pages without redirect loops', async () => {
  const h = middlewareHarness({ email: 'buyer@example.test' }, true)
  const denied = await h.run('/api/admin/products')
  assert.equal(denied.status, 401)
  assert.equal(denied.cookies.get('test-session').value, 'refreshed')
  const redirect = await h.run('/admin/products')
  assert.equal(redirect.status, 307)
  assert.equal(redirect.headers.get('location'), 'https://onesilkribbon.com/admin-login?error=forbidden')
  assert.equal(redirect.cookies.get('test-session').value, 'refreshed')
  const anonymous = await middlewareHarness().run('/admin')
  assert.equal(anonymous.headers.get('location'), 'https://onesilkribbon.com/admin-login')
})

test('verifyAdmin awaits Next request headers and falls back to verified auth, never cookie contents alone', async () => {
  let forwarded = true
  let email = 'admin@example.test'
  let requests = 0
  const { verifyAdmin } = compile(core('lib/admin-auth.js'), {
    process: { env: { ADMIN_EMAILS: 'admin@example.test' } },
    headers: async () => new Headers(forwarded ? { [ADMIN_HEADER]: email } : {}),
    cookies: async () => ({ getAll: () => [{ name: 'test', value: 'session' }] }),
    createServerClient: (_url, _key, options) => {
      assert.equal(options.cookies.getAll()[0].value, 'session')
      return { auth: { getUser: async () => { requests++; return { data: { user: { email } }, error: null } } } }
    },
  }, 'verifyAdmin')
  assert.equal((await verifyAdmin()).email, email)
  assert.equal(requests, 0)
  forwarded = false
  assert.equal((await verifyAdmin()).email, email)
  assert.equal(requests, 1)
  email = 'buyer@example.test'
  assert.equal(await verifyAdmin(), null)
})

test('login callback writes SDK session cookies and redirects only to the site', async () => {
  const { safeNextPath } = compile(core('lib/safe-next.js'), {}, 'safeNextPath')
  const codes = []
  const profiles = []
  const { GET } = compile(read('app/api/auth/callback/route.js'), {
    NextResponse, safeNextPath, ensureUserProfile: async user => { profiles.push(user.id) },
    createServerClient: (_url, _key, options) => ({ auth: { exchangeCodeForSession: async code => {
      codes.push(code)
      options.cookies.setAll([{ name: 'test-session', value: 'verified-session', options: { path: '/', httpOnly: true } }])
      return { data: { user: { id: 'test-user' } }, error: null }
    } } }),
  }, 'GET')
  const response = await GET(new NextRequest('https://onesilkribbon.com/api/auth/callback?code=test-only&next=https://other.example'))
  assert.equal(response.headers.get('location'), 'https://onesilkribbon.com/account')
  assert.equal(response.cookies.get('test-session').value, 'verified-session')
  assert.deepEqual(codes, ['test-only'])
  assert.deepEqual(profiles, ['test-user'])
  const missing = await GET(new NextRequest('https://onesilkribbon.com/api/auth/callback'))
  assert.equal(missing.headers.get('location'), 'https://onesilkribbon.com/login?error=no_code')
  assert.equal(codes.length, 1)
})

test('legacy payment links await async searchParams and exchange credentials before HTML is rendered', async () => {
  let location
  const source = read('app/order-confirmed/page.jsx').replace('return <OrderConfirmedClient />', 'return "confirmation"')
  const { OrderConfirmedPage } = compile(source.replace('export default async function', 'async function'), {
    redirect: url => { location = url; throw new Error('redirected') },
  }, 'OrderConfirmedPage')
  await assert.rejects(OrderConfirmedPage({ searchParams: Promise.resolve({ order: 'OSR-TEST', proof: 'test-only-proof' }) }), /redirected/)
  assert.equal(location, '/api/payment-confirmation?order=OSR-TEST&proof=test-only-proof')
  assert.equal(await OrderConfirmedPage({ searchParams: Promise.resolve({ order: 'OSR-TEST' }) }), 'confirmation')
})
