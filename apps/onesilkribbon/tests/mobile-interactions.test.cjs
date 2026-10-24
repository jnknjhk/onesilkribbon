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

function contactForm({ form, status = 'idle', fetch }) {
  const h = hooks({ 0: form, 1: status })
  const prefix = read('app/contact/page.jsx').split('\n  return (')[0].replace('export default function', 'function')
  const render = compile(`${prefix}\nreturn { handleSubmit, handleChange }\n}`, { ...h.bindings, fetch }, 'Contact')
  return { ...h, render() { h.begin(); return render() } }
}

test('contact rejects whitespace-only required fields and focuses them without sending mail', async () => {
  const h = contactForm({ form: { name: '  ', email: 'test@example.test', message: 'Hello' }, fetch: () => assert.fail('must not send') })
  let focused
  await h.render().handleSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: name => ({ focus: () => { focused = name } }) } } })
  assert.equal(focused, 'name')
  assert.equal(h.states[1], 'error')
  assert.match(h.states[2], /fill in/)
})

test('contact blocks rapid duplicate submissions, retains the draft on failure and supports retry', async () => {
  const form = { name: ' Preview ', email: ' preview@example.test ', message: ' Help ', subject: '', website: '' }
  let resolve, calls = 0, payload
  const h = contactForm({ form, fetch: async (_url, options) => {
    calls++; payload = JSON.parse(options.body)
    if (calls === 1) return new Promise(done => { resolve = done })
    return Response.json({ success: true })
  } })
  const event = { preventDefault() {} }
  const firstRender = h.render()
  const first = firstRender.handleSubmit(event)
  await firstRender.handleSubmit(event)
  assert.equal(calls, 1)
  resolve(Response.json({ success: true }, { status: 503 }))
  await first
  assert.equal(h.states[1], 'error')
  assert.deepEqual(h.states[0], form)
  await h.render().handleSubmit(event)
  assert.equal(calls, 2)
  assert.equal(payload.email, 'preview@example.test')
  assert.equal(payload.name, 'Preview')
  assert.equal(payload.message, 'Help')
  assert.equal(h.states[1], 'sent')
  await h.render().handleSubmit(event)
  assert.equal(calls, 2, 'same successful message must not send twice')
  h.render().handleChange({ target: { name: 'message', value: 'Another question' } })
  assert.equal(h.states[1], 'idle', 'editing enables a new enquiry')
})

test('contact unlocks after a network failure without clearing the entered enquiry', async () => {
  const form = { name: 'Preview', email: 'preview@example.test', message: 'Hello' }
  const h = contactForm({ form, fetch: async () => { throw new Error('Offline') } })
  await h.render().handleSubmit({ preventDefault() {} })
  assert.equal(h.states[1], 'error')
  assert.equal(h.refs[0].current, false)
  assert.deepEqual(h.states[0], form)
})

test('tracking focuses new results below the fixed header without moving the initial empty form', () => {
  const effect = read('app/track-order/page.jsx').match(/useEffect\(\(\) => \{\n    if \(!result\) return[\s\S]*?\}, \[result\]\)/)[0]
  const calls = []
  const run = result => {
    let callback
    compile(effect, { result, resultRef: { current: { focus: () => calls.push('focus'), scrollIntoView: options => calls.push(options.block) } },
      useEffect: fn => { callback = fn },
    }, 'undefined')
    callback()
  }
  run(null); assert.deepEqual(calls, [])
  run({ orderNumber: 'EXAMPLE' }); assert.deepEqual(calls, ['focus', 'start'])
})

test('product photo navigation reveals thumbnails beyond eight without scrolling the mobile page', () => {
  const source = read('app/collections/[slug]/[productSlug]/ProductClient.jsx')
  const effect = source.match(/useEffect\(\(\) => \{\n    const strip = thumbnailStrip.current[\s\S]*?\}, \[imgIdx, selectedSku, selectedAttrs\]\)/)[0]
  let callback, selected, left = 0
  const moves = []
  const strip = { offsetLeft: 20, clientWidth: 276, get scrollLeft() { return left },
    querySelector: () => selected,
    scrollTo: options => { moves.push(options.left); left = options.left },
  }
  compile(effect, { thumbnailStrip: { current: strip }, imgIdx: 8, selectedSku: {}, selectedAttrs: {}, useEffect: fn => { callback = fn } }, 'undefined')
  selected = { offsetLeft: 544, offsetWidth: 60 }
  callback(); assert.equal(left, 328)
  callback(); assert.deepEqual(moves, [328], 'already visible thumbnails do not jump')
  selected = { offsetLeft: 0, offsetWidth: 60 }
  callback(); assert.equal(left, 0)
  selected = null
  callback(); assert.deepEqual(moves, [328, 0])
  assert.ok(!source.includes('images.slice(0, 8)'), 'all product photos remain selectable')
})
