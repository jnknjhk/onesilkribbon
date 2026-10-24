const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')
const compile = (source, bindings, result) => new Function(...Object.keys(bindings), source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `;return ${result}`)(...Object.values(bindings))
function hooks(initial = {}) {
  const states = [], refs = [], effects = [], timers = new Map()
  let stateIndex = 0, refIndex = 0
  return { states, refs, effects, timers,
    begin() { stateIndex = 0; refIndex = 0; effects.length = 0 },
    bindings: {
      useState(initialValue) { const index = stateIndex++; if (!(index in states)) states[index] = index in initial ? initial[index] : initialValue
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
      useRef(value) { const index = refIndex++; return refs[index] ||= { current: value } },
      useEffect: (callback, deps) => effects.push({ callback, deps }),
      setTimeout: (callback, delay) => { const id = {}; timers.set(id, { callback, delay }); return id },
      clearTimeout: id => timers.delete(id),
    },
    tick(delay) { const [id, timer] = [...timers].find(([, value]) => value.delay === delay); timers.delete(id); return timer.callback() },
  }
}
function navbar({ initial = {}, fetch = async () => Response.json([]), window = {}, document = {}, cart = {} } = {}) {
  const h = hooks(initial)
  const source = read('components/Navbar.jsx').split('\n  return (')[0] + '\n}'
  const render = compile(source, { ...h.bindings, fetch, window, document, AbortController,
    useBodyScrollLock() {}, usePathname: () => '/', useRouter: () => ({}), useCart: () => cart, useAuth: () => ({}),
  }, 'Navbar')
  return { ...h, render() { h.begin(); render() } }
}

test('mobile search reports failures distinctly and retries the same query successfully', async () => {
  let attempts = 0
  const h = navbar({ initial: { 2: true, 3: 'silk' }, fetch: async () => ++attempts === 1
    ? Response.json({ error: 'private database error' }, { status: 503 }) : Response.json([{ id: 'result-1' }]) })
  h.render()
  const cleanup = h.effects.find(effect => effect.deps?.[0] === 'silk').callback()
  await h.tick(300)
  assert.equal(h.states[5], false)
  assert.match(h.states[7], /unavailable/)
  assert.ok(!h.states[7].includes('private'))
  assert.deepEqual(h.states[4], [])
  cleanup()
  h.states[8]++
  h.render()
  h.effects.find(effect => effect.deps?.[0] === 'silk').callback()
  await h.tick(300)
  assert.equal(h.states[7], '')
  assert.equal(h.states[4][0].id, 'result-1')
  assert.equal(h.timers.size, 0)
})

test('a stalled mobile search times out and cancellation never leaves an obsolete error', async () => {
  const h = navbar({ initial: { 2: true, 3: 'silk' }, fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Error('aborted')))
  }) })
  h.render()
  const cleanup = h.effects.find(effect => effect.deps?.[0] === 'silk').callback()
  const pending = h.tick(300)
  h.tick(10000)
  await pending
  assert.equal(h.states[5], false)
  assert.match(h.states[7], /try again/)
  cleanup()
  h.render()
  const cancel = h.effects.find(effect => effect.deps?.[0] === 'silk').callback()
  const obsolete = h.tick(300)
  cancel()
  await obsolete
  assert.equal(h.states[7], '')
  assert.equal(h.timers.size, 0)
})

test('desktop resizing closes the mobile menu and cleans up the breakpoint listener', () => {
  let listener, removed = false
  const wide = { matches: false, addEventListener: (_event, fn) => { listener = fn },
    removeEventListener: (_event, fn) => { assert.equal(fn, listener); removed = true } }
  const h = navbar({ initial: { 1: true }, window: { matchMedia: () => wide } })
  h.render()
  const cleanup = h.effects.find(effect => effect.callback.toString().includes('matchMedia')).callback()
  assert.equal(h.states[1], true)
  wide.matches = true; listener()
  assert.equal(h.states[1], false)
  cleanup(); assert.equal(removed, true)
})

test('opening the basket closes navigation panels instead of retaining their scroll locks', () => {
  const h = navbar({ initial: { 1: true, 2: true, 6: true }, cart: { isOpen: true } })
  h.render()
  h.effects.find(effect => effect.callback.toString().includes('if (!cartOpen)')).callback()
  assert.equal(h.states[1], false)
  assert.equal(h.states[2], false)
  assert.equal(h.states[6], false)
  const navigationStyle = read('components/Navbar.jsx').split('<nav ref={navRef}')[1].split('</nav>')[0]
  assert.doesNotMatch(navigationStyle, /transition: ['"]all /, 'Overlay z-index must change immediately, rather than animate under the menu')
})

test('navigation traps visible keyboard controls and does not steal a newer dialog focus', () => {
  let listener
  const document = { body: {}, addEventListener: (_event, callback) => { listener = callback }, removeEventListener() {} }
  const control = () => ({ isConnected: true, getClientRects: () => [{}], focus() { document.activeElement = this } })
  const opener = control(), basket = control(), hidden = { ...control(), getClientRects: () => [] }, firstLink = control(), lastLink = control()
  const root = elements => ({ querySelectorAll: () => elements, querySelector: () => elements[0], contains: element => elements.includes(element) })
  document.activeElement = opener
  const h = navbar({ initial: { 1: true }, document })
  h.render()
  h.refs[2].current = root([opener, basket, hidden]); h.refs[3].current = root([firstLink, lastLink])
  const effect = h.effects.find(effect => effect.callback.toString().includes('const trapTab')).callback
  const cleanup = effect()
  assert.equal(document.activeElement, firstLink)
  document.activeElement = lastLink
  let prevented = false
  listener({ key: 'Tab', preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(document.activeElement, opener)
  listener({ key: 'Tab', shiftKey: true, preventDefault() {} })
  assert.equal(document.activeElement, lastLink)
  document.activeElement = basket
  cleanup()
  assert.equal(document.activeElement, basket, 'Switching to the basket must preserve its trigger')
  const closeAgain = effect()
  const newerDialog = control(); document.activeElement = newerDialog
  closeAgain()
  assert.equal(document.activeElement, newerDialog)
})

test('password recovery traps focus, closes on Escape and restores the trigger', () => {
  let listener
  const document = { body: {}, addEventListener: (_event, callback, capture) => { assert.equal(capture, true); listener = callback }, removeEventListener() {} }
  const control = () => ({ isConnected: true, focus() { document.activeElement = this } })
  const opener = control(), close = control(), email = control(), send = control()
  document.activeElement = opener
  const h = hooks({ 7: true })
  const prefix = read('app/login/page.jsx').split('function LoginContent() {')[1].split('  if (loading || user) return null')[0]
  const render = compile(`function Component() {${prefix}}`, { ...h.bindings, document,
    useAuth: () => ({}), useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), safeNextPath: () => '/account', useBodyScrollLock() {},
  }, 'Component')
  h.begin(); render()
  h.refs[0].current = { querySelectorAll: () => [close, email, send], querySelector: () => email, contains: element => [close, email, send].includes(element) }
  const cleanup = h.effects.find(effect => effect.callback.toString().includes('if (!showForgot)')).callback()
  assert.equal(document.activeElement, email)
  document.activeElement = send
  listener({ key: 'Tab', stopImmediatePropagation() {}, preventDefault() {} })
  assert.equal(document.activeElement, close)
  listener({ key: 'Escape', stopImmediatePropagation() {} })
  assert.equal(h.states[7], false)
  cleanup()
  assert.equal(document.activeElement, opener)
})

test('checkout validates every field and focuses the first error on a long mobile form', () => {
  const section = read('app/checkout/page.jsx').split('  const validate = () => {')[1].split('\n  const applyCoupon')[0]
  const checked = [], focused = [], scrolled = []
  const validate = compile(`const validate = () => {${section}`, {
    form: {}, setTouched() {}, validateField: field => { checked.push(field); return field !== 'firstName' && field !== 'phone' },
    document: { getElementById: id => ({ focus: () => focused.push(id), scrollIntoView: () => scrolled.push(id) }) },
  }, 'validate')
  assert.equal(validate(), false)
  assert.equal(checked.length, 7)
  assert.deepEqual(focused, ['checkout-firstName'])
  assert.deepEqual(scrolled, ['checkout-firstName'])
})

test('checkout step changes focus their heading, while initial render preserves user position', () => {
  const effect = read('app/checkout/page.jsx').match(/useEffect\(\(\) => \{\n    if \(previousStep.current === step\)[\s\S]*?\}, \[step\]\)/)[0]
  const previousStep = { current: 'details' }, calls = []
  const run = step => {
    let callback
    compile(effect, { previousStep, step, stepHeading: { current: { focus: () => calls.push('focus'), scrollIntoView: () => calls.push('scroll') } },
      useEffect: fn => { callback = fn },
    }, 'undefined')
    callback()
  }
  run('details'); assert.deepEqual(calls, [])
  run('payment'); assert.deepEqual(calls, ['focus', 'scroll'])
  assert.equal(previousStep.current, 'payment')
})
