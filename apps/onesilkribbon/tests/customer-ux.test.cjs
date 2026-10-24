const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const compile = (source, bindings, result) => new Function(...Object.keys(bindings),
  source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `; return ${result}`
)(...Object.values(bindings))
const flush = () => new Promise(resolve => setImmediate(resolve))

function hooks(initial = {}) {
  const states = [], refs = [], effects = [], timers = new Map()
  let stateIndex = 0, refIndex = 0
  return {
    states, refs, effects, timers,
    begin() { stateIndex = 0; refIndex = 0; effects.length = 0 },
    bindings: {
      useState(value) {
        const index = stateIndex++
        if (!(index in states)) states[index] = index in initial ? initial[index] : typeof value === 'function' ? value() : value
        return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
      },
      useRef(value) { const index = refIndex++; return refs[index] ||= { current: value } },
      useCallback: callback => callback,
      useEffect: (callback, deps) => effects.push({ callback, deps }),
      setTimeout: callback => { const id = {}; timers.set(id, callback); return id },
      clearTimeout: id => timers.delete(id),
    },
  }
}

function addressHarness(request, { confirm = true, initial = {} } = {}) {
  const h = hooks(initial)
  const section = read('app/account/addresses/page.jsx').split('export default function AddressesPage() {')[1].split('\n  return (')[0]
  const run = compile(`function Component() {${section}\nreturn {load,saveAddress,remove};}`, {
    ...h.bindings, useAuth: () => ({ user: { id: 'test-user', accessToken: 'test-token' } }),
    accountRequest: request, window: { confirm: () => confirm },
  }, 'Component')
  return { ...h, render() { h.begin(); return run() } }
}

test('account requests never send tokens to external URLs or emit Bearer undefined', async () => {
  const calls = []
  const request = compile(read('lib/account-request.js'), { fetch: async (url, options) => {
    calls.push({ url, options }); return Response.json({ addresses: [] })
  } }, 'accountRequest')
  await request('/api/user/addresses', { id: 'test-user' })
  assert.equal(calls[0].options.headers.Authorization, undefined)
  assert.equal(calls[0].options.credentials, 'same-origin')
  assert.equal(calls[0].options.cache, 'no-store')
  await request('/api/user/profile', { accessToken: 'test-token' }, { method: 'PATCH', body: { first_name: 'Test' } })
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token')
  assert.deepEqual(JSON.parse(calls[1].options.body), { first_name: 'Test' })
  for (const endpoint of ['https://other.example/api/user/profile', '//other.example/api/user/profile', '/api/user/../admin']) {
    await assert.rejects(request(endpoint, { accessToken: 'test-token' }), /Invalid account endpoint/)
  }
  assert.equal(calls.length, 2)
})

test('failed account HTTP responses are not parsed as success and never expose server messages', async () => {
  for (const status of [401, 403, 409, 500]) {
    const request = compile(read('lib/account-request.js'), { fetch: async () => ({
      ok: false, status, json: () => { throw Error('private database information') },
    }) }, 'accountRequest')
    await assert.rejects(request('/api/user/addresses', {}), error => {
      assert.doesNotMatch(error.message, /private database/)
      return status === 401 ? /sign in again/.test(error.message) : /Please try again/.test(error.message)
    })
  }
})

test('address save failure retains the open form and old list; repeated clicks cannot duplicate a write', async () => {
  let rejectWrite, calls = 0
  const h = addressHarness(() => { calls++; return new Promise((_resolve, reject) => { rejectWrite = reject }) }, {
    initial: { 0: [{ id: 'saved-address' }], 3: 'add' },
  })
  const actions = h.render()
  const save = actions.saveAddress({ first_name: 'Unsaved form value' })
  await actions.saveAddress({ first_name: 'Duplicate' })
  assert.equal(calls, 1)
  rejectWrite(new Error('Address was not saved'))
  await save
  assert.equal(h.states[3], 'add')
  assert.deepEqual(h.states[0], [{ id: 'saved-address' }])
  assert.equal(h.states[2], false)
  assert.match(h.states[5], /not saved/)
})

test('successful address save closes the form only after the server confirms it', async () => {
  const methods = []
  const h = addressHarness(async (_path, _user, options = {}) => {
    methods.push(options.method || 'GET')
    return options.method ? { address: { id: 'new' } } : { addresses: [{ id: 'new' }] }
  }, { initial: { 3: 'add' } })
  await h.render().saveAddress({ first_name: 'Test' })
  assert.deepEqual(methods, ['POST', 'GET'])
  assert.equal(h.states[3], null)
  assert.deepEqual(h.states[0], [{ id: 'new' }])
})

test('failed removal keeps the address visible, while a declined confirmation sends nothing', async () => {
  let calls = 0
  const request = async () => { calls++; throw Error('Not removed') }
  const h = addressHarness(request, { initial: { 0: [{ id: 'saved' }] } })
  await h.render().remove('saved')
  assert.deepEqual(h.states[0], [{ id: 'saved' }])
  assert.equal(h.states[4], null)
  assert.equal(h.states[5], 'Not removed')
  await addressHarness(request, { confirm: false }).render().remove('saved')
  assert.equal(calls, 1)
})

test('address load failure retains known data; cancelled old responses cannot overwrite it', async () => {
  const h = addressHarness(async () => { throw Error('Unavailable') }, { initial: { 0: [{ id: 'saved' }] } })
  await h.render().load()
  assert.deepEqual(h.states[0], [{ id: 'saved' }])
  assert.equal(h.states[1], false)
  let resolve
  const old = addressHarness(() => new Promise(done => { resolve = done }), { initial: { 0: [{ id: 'current' }] } })
  const controller = new AbortController()
  const load = old.render().load(controller.signal)
  controller.abort()
  resolve({ addresses: [{ id: 'obsolete' }] })
  await load
  assert.deepEqual(old.states[0], [{ id: 'current' }])
})

function profileHarness(request, initial = {}) {
  const h = hooks(initial)
  let user = { id: 'test-user', accessToken: 'test-token' }
  const section = read('app/account/profile/page.jsx').split('export default function ProfilePage() {')[1].split('\n  const inp =')[0]
  const run = compile(`function Component() {${section}\nreturn {save};}`, {
    ...h.bindings, useAuth: () => ({ user }), accountRequest: request,
  }, 'Component')
  return { ...h, render(nextUser = user) { user = nextUser; h.begin(); return run() } }
}

test('profile success no longer calls nonexistent refreshUser or reports a saved profile as failed', async () => {
  let calls = 0
  const h = profileHarness(async () => { calls++; return { profile: { first_name: 'Test' } } }, { 5: true })
  await h.render().save()
  assert.equal(calls, 1)
  assert.equal(h.states[3], true)
  assert.equal(h.states[4], '')
  assert.equal(h.states[2], false)
  assert.equal(h.timers.size, 1)
  h.effects[0].callback()()
  assert.equal(h.timers.size, 0)
})

test('profile cannot overwrite data after a failed initial load', async () => {
  let calls = 0
  const h = profileHarness(async () => { calls++; throw Error('Unavailable') })
  const actions = h.render()
  h.effects[1].callback()
  await flush()
  assert.equal(h.states[5], false)
  assert.equal(h.states[1], false)
  await actions.save()
  assert.equal(calls, 1)
})

test('token refresh does not refetch profile and erase in-progress edits', async () => {
  let calls = 0
  const h = profileHarness(async () => { calls++; return { profile: { first_name: 'Saved' } } })
  h.render()
  const cleanup = h.effects[1].callback()
  await flush()
  h.states[0] = { first_name: 'Currently typing', last_name: '', phone: '' }
  cleanup()
  h.render({ id: 'test-user', accessToken: 'refreshed-token' })
  h.effects[1].callback()
  await flush()
  assert.equal(calls, 1)
  assert.equal(h.states[0].first_name, 'Currently typing')
})

const merge = compile(read('lib/checkout-autofill.js'), {}, 'mergeCheckoutAutofill')
const empty = () => ({ email: '', firstName: '', lastName: '', line1: '', line2: '', city: '', postcode: '', country: 'GB', dialCode: '+44', phone: '' })
test('checkout autofill fills untouched fields but respects intentionally cleared fields', () => {
  const form = { ...empty(), firstName: 'Typed' }
  const result = merge(form, { firstName: 'Saved', lastName: 'Saved surname', email: 'saved@example.test' }, new Set(['firstName', 'email']))
  assert.equal(result.firstName, 'Typed')
  assert.equal(result.email, '')
  assert.equal(result.lastName, 'Saved surname')
  assert.deepEqual(form, { ...empty(), firstName: 'Typed' })
})

test('partly typed addresses cannot mix with a different saved country, postcode or calling code', () => {
  const result = merge({ ...empty(), line1: 'New delivery address' }, {
    line1: 'Old address', city: 'Old city', postcode: '10001', country: 'US', dialCode: '+1', firstName: 'Saved', unknown: 'ignored',
  }, new Set(['line1']))
  assert.equal(result.line1, 'New delivery address')
  assert.equal(result.city, '')
  assert.equal(result.country, 'GB')
  assert.equal(result.dialCode, '+44')
  assert.equal(result.firstName, 'Saved')
  assert.equal(result.unknown, undefined)
})

test('collection props update the displayed collection without hidden headings or client catalog reads', () => {
  const source = read('app/collections/[slug]/CollectionClient.jsx')
  const section = source.split('export default function CollectionClient(')[1].split('\n  return (')[0]
  const h = hooks()
  const run = compile(`function Component(${section}\nreturn {slug,products,heroImg,sorted};}`, {
    ...h.bindings, COLLECTION_META: {}, safe: String,
  }, 'Component')
  h.begin()
  assert.equal(run({ slug: 'first', initialProducts: [{ id: 'first' }], initialHeroImage: 'first.jpg' }).products[0].id, 'first')
  h.begin()
  const next = run({ slug: 'second', initialProducts: [{ id: 'second' }], initialHeroImage: 'second.jpg' })
  assert.equal(next.slug, 'second')
  assert.equal(next.products[0].id, 'second')
  assert.equal(next.heroImg, 'second.jpg')
  assert.doesNotMatch(source, /heroVisible|supabase|setProducts|Loading collection/)
  assert.match(source, /aria-label="Sort products"/)
})

test('welcome dialog uses shared scroll locking and cannot crash when storage is unavailable', () => {
  const h = hooks({ 0: true })
  const source = read('components/WelcomePopup.jsx').split('\n  if (!show) return null')[0]
  const locks = []
  const Component = compile(source.replace('export default function', 'function') + '\nreturn {handleClose};\n}', {
    ...h.bindings, usePathname: () => '/', useSearchParams: () => new URLSearchParams(),
    useBodyScrollLock: show => locks.push(show),
    localStorage: { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } },
  }, 'WelcomePopup')
  h.begin()
  const popup = Component()
  assert.doesNotThrow(() => h.effects[1].callback())
  assert.doesNotThrow(() => popup.handleClose())
  assert.equal(h.states[0], false)
  assert.deepEqual(locks, [true])
  assert.doesNotMatch(source, /document.body.style.overflow/)
})

test('delayed checkout autofill and cancelled requests respect edits made while the request was running', async () => {
  const source = read('app/checkout/page.jsx')
  const start = source.indexOf('  // ── 登录用户自动预填默认地址')
  const section = source.slice(start, source.indexOf('\n  if (items.length === 0)', start))
  for (const cancel of [false, true]) {
    let effect, resolve
    let form = empty()
    const editedFields = { current: new Set() }, prefilledUser = { current: null }
    const run = compile(`function Setup() {${section}\n}`, {
      user: { id: 'test-user', email: 'test@example.test' }, editedFields, prefilledUser,
      accountRequest: () => new Promise(done => { resolve = done }),
      mergeCheckoutAutofill: merge, getCountry: () => ({ dialCode: '+1' }),
      useEffect: callback => { effect = callback }, setForm: update => { form = update(form) },
    }, 'Setup')
    run()
    const cleanup = effect()
    form.line1 = 'Customer is typing'
    editedFields.current.add('line1')
    if (cancel) cleanup()
    resolve({ addresses: [{ first_name: 'Saved', line1: 'Old address', country: 'US', city: 'Old city' }] })
    await flush()
    assert.equal(form.line1, 'Customer is typing')
    assert.equal(form.country, 'GB')
    assert.equal(form.dialCode, '+44')
    assert.equal(form.city, '')
    assert.equal(form.firstName, cancel ? '' : 'Saved')
    assert.equal(prefilledUser.current, cancel ? null : 'test-user')
    cleanup()
  }
})

test('welcome dialog traps Tab, handles Escape before lower overlays and restores focus', () => {
  const h = hooks({ 0: true })
  let listener
  const previous = { isConnected: true, focus() { document.activeElement = previous } }
  const document = {
    activeElement: previous,
    addEventListener: (_name, callback, capture) => { assert.equal(capture, true); listener = callback },
    removeEventListener: (_name, callback, capture) => { assert.equal(capture, true); assert.equal(callback, listener); listener = null },
  }
  const first = { focus() { document.activeElement = first } }, last = { focus() { document.activeElement = last } }
  const section = read('components/WelcomePopup.jsx').split('\n  if (!show) return null')[0]
  const Component = compile(section.replace('export default function', 'function') + '\n}', {
    ...h.bindings, usePathname: () => '/', useSearchParams: () => new URLSearchParams(),
    useBodyScrollLock() {}, document, localStorage: { setItem() {} },
  }, 'WelcomePopup')
  h.begin(); Component()
  h.refs[0].current = { querySelectorAll: () => [first, last], contains: element => [first, last].includes(element) }
  const cleanup = h.effects[4].callback()
  assert.equal(document.activeElement, first)
  let prevented = false, stopped = false
  listener({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true }, stopImmediatePropagation() { stopped = true } })
  assert.equal(document.activeElement, last)
  assert.equal(prevented, true)
  assert.equal(stopped, true, 'Lower basket trap must not run after the top welcome dialog')
  stopped = false
  listener({ key: 'Escape', stopImmediatePropagation() { stopped = true } })
  assert.equal(stopped, true)
  assert.equal(h.states[0], false)
  cleanup()
  assert.equal(document.activeElement, previous)
  assert.equal(listener, null)
})

test('welcome submission locks rapid repeated input and always releases loading after completion', async () => {
  const h = hooks({ 0: true, 2: 'test@example.test' })
  let resolve, requests = 0
  const source = read('components/WelcomePopup.jsx').split('\n  if (!show) return null')[0]
  const Component = compile(source.replace('export default function', 'function') + '\nreturn {handleSubmit};\n}', {
    ...h.bindings, usePathname: () => '/', useSearchParams: () => new URLSearchParams(), useBodyScrollLock() {},
    isValidEmail: () => true, subscribeEmail: () => { requests++; return new Promise(done => { resolve = done }) },
  }, 'WelcomePopup')
  h.begin()
  const popup = Component()
  const first = popup.handleSubmit()
  await popup.handleSubmit()
  assert.equal(requests, 1)
  assert.equal(h.states[3], true)
  resolve({ ok: true })
  await first
  assert.equal(h.states[1], 'sent')
  assert.equal(h.states[3], false)
  assert.equal(h.refs[1].current, false)
})
