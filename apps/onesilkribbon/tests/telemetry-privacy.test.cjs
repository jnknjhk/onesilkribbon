const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const source = read('lib/telemetry-privacy.js')
const load = async () => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const json = value => JSON.parse(JSON.stringify(value))

test('all hooks remove URL credentials, every query/fragment and embedded URLs', async () => {
  const { telemetryPrivacyHooks } = await load()
  const cases = [
    ['https://login:credential@example.com/pay?arbitrary=QUERY#FRAGMENT', 'https://example.com/pay'],
    ['https://login%40example.com:credential@example.com:443/pay?x=QUERY', 'https://example.com:443/pay'],
    ['//login:credential@example.com/pay#FRAGMENT?x=QUERY', '//example.com/pay'],
    ['/pay?x=QUERY&unknown=SECRET#FRAGMENT', '/pay'],
    ['./pay?x=QUERY', './pay'], ['../pay#FRAGMENT', '../pay'],
    ['pay?x=QUERY', 'pay'], ['?x=QUERY', ''], ['#FRAGMENT', ''],
    ['https://example.com?x=QUERY', 'https://example.com'],
    ['https://login:credential@example.com/pay', 'https://example.com/pay'],
    ["https://o'neil:credential@example.com/pay?x=QUERY", 'https://example.com/pay'],
    ["/pay?unknown=QUERY'PRIVATE#FRAGMENT", '/pay'],
    ['/pay?unknown=QUERY"PRIVATE#FRAGMENT', '/pay'],
    ['https:login:credential@example.com/pay?x=QUERY', 'https:example.com/pay'],
    ['https:\\login:credential@example.com/pay?x=QUERY', 'https:\\example.com/pay'],
  ]
  for (const [name, hook] of Object.entries(telemetryPrivacyHooks)) {
    for (const [url, expected] of cases) {
      const input = { message: `Failed GET ${url} next`, url }
      const output = hook(input)
      assert.equal(output.url, expected, `${name}: ${url}`)
      assert.equal(output.message, `Failed GET ${expected} next`, `${name}: embedded ${url}`)
      assert.equal(input.url, url, 'does not mutate the source')
    }
    const output = hook({ message: 'GET https://u:p@one.example/a?x=QUERY and /b#FRAGMENT and bare?x=QUERY' })
    assert.equal(output.message, 'GET https://one.example/a and /b and bare')
    assert.equal(hook({ url: '/a?x=QUERY with spaces#FRAGMENT' }).url, '/a')
    assert.deepEqual(hook(hook({ message: 'buyer@example.com', extra: { nested: 'password=PRIVATE' } })),
      { message: '[Filtered]', extra: { nested: '[Filtered]' } })
  }
})

test('error events drop request payloads, user and private headers while keeping stack locations', async () => {
  const { telemetryPrivacyHooks: hooks } = await load()
  const input = {
    event_id: 'a'.repeat(32), level: 'error', message: 'Buyer buyer@example.com failed at /pay?x=QUERY#FRAGMENT',
    request: {
      method: 'POST', url: 'https://u:p@onesilkribbon.com/api/pay?x=QUERY#FRAGMENT',
      query_string: [['arbitrary', 'QUERY']], data: { harmless: 'BODY' }, body: 'BODY', cookies: { cart: 'COOKIE' },
      headers: {
        Authorization: 'Bearer AUTH', 'pRoXy-AuThOrIzAtIoN': 'AUTH', COOKIE: 'COOKIE', 'Set-Cookie': 'COOKIE',
        'X-Api-Key': 'APIKEY', 'X-Forwarded-For': '192.0.2.1', 'X-Custom-Secret': 'SECRET',
        Referer: 'https://u:p@example.com/account?x=QUERY#FRAGMENT',
        'Content-Type': 'application/json', Accept: 'application/json',
      },
    },
    user: { id: 'USERID', email: 'buyer@example.com', username: 'USERNAME', ip_address: '192.0.2.1', name: 'NAME' },
    exception: { values: [{ type: 'TypeError', value: 'GET /pay?x=QUERY failed for buyer@example.com', stacktrace: {
      frames: [{ filename: 'https://cdn.example.com/app.js?x=QUERY#FRAGMENT', abs_path: '/src/pay.js?x=QUERY',
        function: 'checkout', lineno: 42, colno: 7, in_app: true, vars: { token: 'TOKEN', count: 2 } }],
    } }] },
    sdkProcessingMetadata: { normalizedRequest: { body: 'BODY', cookies: 'COOKIE' } },
  }
  const snapshot = JSON.stringify(input)
  const output = hooks.beforeSend(input, { originalException: new Error('SECRET'), attachments: [{ data: 'SECRET' }] })
  assert.equal(JSON.stringify(input), snapshot)
  assert.equal(output.event_id, input.event_id)
  assert.equal(output.request.method, 'POST')
  assert.equal(output.request.url, 'https://onesilkribbon.com/api/pay')
  assert.deepEqual(output.request.headers, { Referer: 'https://example.com/account', 'Content-Type': 'application/json', Accept: 'application/json' })
  for (const key of ['body', 'data', 'query_string', 'cookies']) assert.ok(!(key in output.request))
  assert.ok(!('user' in output))
  assert.ok(!('sdkProcessingMetadata' in output))
  const frame = output.exception.values[0].stacktrace.frames[0]
  assert.deepEqual(frame, { filename: 'https://cdn.example.com/app.js', abs_path: '/src/pay.js', function: 'checkout', lineno: 42, colno: 7, in_app: true, vars: { count: 2 } })
  assert.doesNotMatch(JSON.stringify(output), /QUERY|FRAGMENT|AUTH|COOKIE|BODY|USERID|USERNAME|buyer@|192\.0\.2\.1/)
})

test('transactions, HTTP span attributes and navigation/HTTP breadcrumbs are scrubbed', async () => {
  const { telemetryPrivacyHooks: hooks } = await load()
  const span = {
    span_id: 'b'.repeat(16), trace_id: 'c'.repeat(32), op: 'http.client', start_timestamp: 10, timestamp: 11,
    description: 'GET https://u:p@api.example.com/orders?x=QUERY#FRAGMENT',
    data: { url: '/orders?x=QUERY', 'http.url': 'https://u:p@api.example.com/orders#FRAGMENT',
      'url.full': 'https://api.example.com/orders?x=QUERY', 'http.request.body': 'BODY',
      'http.status_code': 503, nested: { authorization: 'AUTH', route: '/orders#FRAGMENT' } },
  }
  const transaction = hooks.beforeSendTransaction({ type: 'transaction', transaction: 'GET /pay?x=QUERY#FRAGMENT',
    contexts: { trace: { trace_id: span.trace_id, span_id: span.span_id, data: span.data } }, spans: [span],
    breadcrumbs: [{ category: 'navigation', data: { from: '/account?x=QUERY', to: 'https://u:p@example.com/pay#FRAGMENT' } }],
  })
  assert.equal(transaction.transaction, 'GET /pay')
  assert.deepEqual(transaction.spans[0], hooks.beforeSendSpan(span))
  assert.equal(transaction.spans[0].description, 'GET https://api.example.com/orders')
  assert.deepEqual(transaction.spans[0].data, {
    url: '/orders', 'http.url': 'https://api.example.com/orders', 'url.full': 'https://api.example.com/orders',
    'http.status_code': 503, nested: { route: '/orders' },
  })
  assert.deepEqual(transaction.breadcrumbs[0].data, { from: '/account', to: 'https://example.com/pay' })
  const breadcrumb = hooks.beforeBreadcrumb({ category: 'fetch', message: 'POST /api/pay?x=QUERY', data: span.data }, { input: 'SECRET' })
  assert.equal(breadcrumb.message, 'POST /api/pay')
  assert.doesNotMatch(JSON.stringify({ transaction, breadcrumb }), /QUERY|FRAGMENT|BODY|AUTH|SECRET|u:p@/)
})

test('nested sensitive fields, serialized JSON and labeled exception secrets cannot bypass scrubbing', async () => {
  const { telemetryPrivacyHooks: hooks } = await load()
  const sensitive = ['email', 'customer_email', 'PASSWORD', 'passwd', 'paymentProof', 'access_token', 'refreshToken',
    'session_id', 'sessionId', 'authorization', 'cookie', 'cookies', 'firstName', 'first_name', 'lastName',
    'shipping_name', 'shippingName', 'customerName', 'shippingAddress', 'address', 'phone', 'phone_number',
    'username', 'ip_address', 'user_ip', 'apiKey', 'client_secret', 'line1', 'line2', 'city', 'postcode', 'dialCode']
  const privateData = Object.fromEntries(sensitive.map(key => [key, `PRIVATE-${key}`]))
  const output = hooks.beforeSend({ extra: { records: [{ safe: 1, ...privateData }],
    serialized: JSON.stringify({ ...privateData, safe: '/ok?x=QUERY', nested: [{ token: 'PRIVATE', count: 3 }] }),
    malformed: '{"password":"PRIVATE"',
    inline: 'Failed payload: {"password":"PRIVATE"}',
    shipping: { name: 'PRIVATE', arbitrary: 'PRIVATE' },
  }, contexts: { custom: { deep: [{ ...privateData, safe: 'ok' }] } },
  exception: { values: [{ value: 'Failed with password=PRIVATE more private text' }] } })
  assert.deepEqual(output.extra.records, [{ safe: 1 }])
  assert.deepEqual(JSON.parse(output.extra.serialized), { safe: '/ok', nested: [{ count: 3 }] })
  assert.deepEqual(output.contexts.custom.deep, [{ safe: 'ok' }])
  assert.doesNotMatch(JSON.stringify(output), /PRIVATE|QUERY/)
})

test('invalid values, cycles, accessors, exotic objects and serialization traps fail closed', async () => {
  const { telemetryPrivacyHooks } = await load()
  for (const [name, hook] of Object.entries(telemetryPrivacyHooks)) {
    const rejected = name === 'beforeSendSpan' ? {} : null
    for (const invalid of [null, undefined, false, 1, 'SECRET', [], new Error('SECRET'), new Date()]) {
      assert.deepEqual(hook(invalid), rejected)
    }
    const cyclic = { message: 'GET /ok?x=QUERY', extra: { count: 2 } }
    cyclic.extra.parent = cyclic
    cyclic.extra.self = cyclic.extra
    const shared = { safe: 1, token: 'SECRET' }
    cyclic.extra.firstCopy = shared
    cyclic.extra.secondCopy = shared
    Object.defineProperty(cyclic.extra, 'getter', { enumerable: true, get() { throw new Error('must not execute') } })
    cyclic.extra.toJSON = () => { throw new Error('must not execute') }
    cyclic.extra.date = new Date()
    cyclic.extra.url = new URL('https://u:p@example.com/?x=SECRET')
    cyclic.extra.nonfinite = Infinity
    cyclic.extra.bigint = 1n
    const output = hook(cyclic)
    assert.deepEqual(output, { message: 'GET /ok', extra: { count: 2, firstCopy: { safe: 1 }, secondCopy: { safe: 1 } } })
    assert.doesNotThrow(() => JSON.stringify(output))
    const hostile = new Proxy({}, { ownKeys() { throw new Error('SECRET') } })
    assert.deepEqual(hook(hostile), rejected)
    assert.deepEqual(hook({ extra: hostile }), rejected)
    const revoked = Proxy.revocable({}, {})
    revoked.revoke()
    assert.deepEqual(hook(revoked.proxy), rejected)
    assert.deepEqual(hook({ request: { headers: [['Authorization', 'SECRET']] } }), { request: {} })
    for (const request of ['RAW-PRIVATE', ['RAW-PRIVATE'], 1, null]) assert.deepEqual(hook({ request }), {})
    assert.deepEqual(hook({ request: { headers: 'RAW-PRIVATE' } }), { request: {} })
    const pollution = JSON.parse('{"extra":{"__proto__":{"token":"SECRET"},"constructor":"SECRET","safe":1}}')
    assert.deepEqual(hook(pollution), { extra: { safe: 1 } })
  }
})

test('depth, width and string budgets discard unsafe data without truncating a secret prefix', async () => {
  const { telemetryPrivacyHooks: hooks } = await load()
  const input = { message: 'safe' }
  let current = input
  for (let i = 0; i < 100; i++) current = current.child = {}
  current.email = 'SECRET'
  const output = hooks.beforeSend(input)
  assert.equal(output.message, 'safe')
  assert.doesNotMatch(JSON.stringify(output), /SECRET|email/)
  assert.deepEqual(hooks.beforeSend({ message: 'SECRET'.repeat(10000), level: 'error' }), { level: 'error' })
  assert.equal(hooks.beforeSend({ extra: Object.fromEntries(Array.from({ length: 10001 }, (_, i) => [`k${i}`, i])) }), null)
  assert.equal(hooks.beforeSend({ extra: Array(9).fill('a'.repeat(32768)) }), null)
  assert.ok(JSON.stringify(output).length < 1000)
})

test('all runtime configs install hooks and keep browser init independent of requestDataIntegration', () => {
  for (const runtime of ['client', 'server', 'edge']) {
    let options
    const includes = []
    const sentry = { init(value) { options = value } }
    if (runtime !== 'client') sentry.requestDataIntegration = options => {
      includes.push(options.include)
      return { name: 'RequestData' }
    }
    // No process, require, Buffer, URL or network APIs in the scrubber's realm.
    const context = vm.createContext({})
    vm.runInContext(source.replace('export const telemetryPrivacyHooks', 'const telemetryPrivacyHooks'), context)
    context.Sentry = sentry
    context.process = { env: { NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_DSN: 'test-only' } }
    const configFile = runtime === 'client' ? 'instrumentation-client.js' : `sentry.${runtime}.config.js`
    vm.runInContext(read(configFile).replace(/^import .*$/gm, '').replace(/^export /gm, ''), context)
    assert.equal(options.sendDefaultPii, false)
    assert.equal(options.enabled, true)
    assert.equal(options.tracesSampleRate, runtime === 'edge' ? 0 : 0.1)
    for (const name of ['beforeSend', 'beforeSendTransaction', 'beforeSendSpan', 'beforeBreadcrumb']) {
      assert.equal(typeof options[name], 'function')
      assert.deepEqual(json(options[name]({ message: 'GET /pay?x=SECRET', extra: { token: 'SECRET', count: 2 } })),
        { message: 'GET /pay', extra: { count: 2 } })
    }
    if (runtime !== 'client') assert.deepEqual(json(includes), [{ data: false, cookies: false, query_string: false, user: false, ip: false, headers: false }])
    else assert.deepEqual(includes, [])
  }
  assert.doesNotMatch(source, /^import\s|\b(?:require\s*\(|process\.|Buffer\.|fetch\s*\()/m)
})

test('installed RequestData integration honors the disabled collection options', () => {
  // Import the factory only; never initialize a Sentry client or transport.
  const { requestDataIntegration } = require('@sentry/core')
  const integration = requestDataIntegration({ include: {
    data: false, cookies: false, query_string: false, user: false, ip: false, headers: false,
  } })
  const output = integration.processEvent({ sdkProcessingMetadata: {
    normalizedRequest: { method: 'POST', url: 'https://example.com/pay?x=QUERY', data: 'BODY', cookies: { a: 'COOKIE' }, headers: { Authorization: 'AUTH' } },
    request: { ip: '192.0.2.1', user: { email: 'buyer@example.com' } },
  } }, {}, { getDataCollectionOptions: () => ({
    cookies: false, httpHeaders: { request: false }, urlQueryParams: false, userInfo: false,
  }) })
  assert.equal(output.request.method, 'POST')
  for (const field of ['data', 'cookies', 'query_string', 'headers']) assert.ok(!(field in output.request))
  assert.ok(!output.user)
})

test('installed Sentry envelope never restores an oversized original span after privacy rejection', async () => {
  const { createSpanEnvelope } = require('@sentry/core')
  const { telemetryPrivacyHooks } = await load()
  const privateSpan = { description: 'SECRET'.repeat(50000), data: Object.fromEntries(Array.from({ length: 10001 }, (_, i) => [`k${i}`, 'PRIVATE'])) }
  const span = { getSpanJSON: () => privateSpan }
  const client = { getOptions: () => telemetryPrivacyHooks, getDsn: () => undefined }
  const envelope = createSpanEnvelope([span], client)
  const serialized = JSON.stringify(envelope)
  assert.doesNotMatch(serialized, /SECRET|PRIVATE/)
  assert.deepEqual(telemetryPrivacyHooks.beforeSendSpan(privateSpan), {})
})
