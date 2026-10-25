const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')
const compile = (source, bindings, result) => new Function(...Object.keys(bindings), source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `;return ${result}`)(...Object.values(bindings))

function welcome({ mobile = true, query = '' } = {}) {
  const states = [], effects = [], timers = new Map(), listeners = new Map()
  const source = read('components/WelcomePopup.jsx').split('\n  if (!show) return null')[0]
  const render = compile(source.replace('export default function', 'function') + '\n}', {
    useState: initial => { const i = states.length; states.push(initial); return [initial, value => { states[i] = value }] },
    useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => effects.push(fn),
    usePathname: () => '/', useSearchParams: () => new URLSearchParams(query), useBodyScrollLock() {},
    localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null },
    window: { matchMedia: () => ({ matches: mobile }), history: { replaceState() {} },
      addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type),
    },
    setTimeout: (fn, delay) => { timers.set(delay, fn); return delay }, clearTimeout: id => timers.delete(id),
  }, 'WelcomePopup')
  render()
  return { states, effects, timers, listeners }
}

test('mobile visitors get no automatic promotional dialog but can open the offer by choice', () => {
  const h = welcome()
  h.effects[1]()
  assert.equal(h.timers.size, 0)
  assert.equal(h.states[0], false)
  const cleanup = h.effects[5]()
  h.listeners.get('osr:welcome-open')()
  assert.equal(h.states[0], true)
  assert.equal(h.states[1], 'form')
  cleanup()
  assert.equal(h.listeners.size, 0)
})

test('desktop invitation cleanup and intentional email verification results remain functional', () => {
  const desktop = welcome({ mobile: false })
  const cleanup = desktop.effects[1]()
  assert.equal(desktop.timers.size, 1)
  cleanup()
  assert.equal(desktop.timers.size, 0)
  const verified = welcome({ query: 'verified=success&code=EXAMPLE' })
  verified.effects[0]()
  assert.equal(verified.states[0], true)
  assert.equal(verified.states[1], 'success')
  assert.equal(verified.states[5], 'EXAMPLE')
})

function collectionIndex({ products, pictures = [], error = null }) {
  const prefix = read('app/collections/page.jsx').split('export default async function CollectionsPage() {')[1].split('\n  return (')[0]
  return compile(`async function render() {${prefix}\nreturn available;}`, {
    COLLECTIONS: [{ slug: 'fine' }, { slug: 'empty' }, { slug: 'tools' }],
    supabaseAdmin: { from: table => ({ select: () => ({
      eq: async () => ({ data: products, error }), in: async () => ({ data: pictures }),
    }) }) },
  }, 'render')()
}

test('collection navigation uses real published inventory and photographs and omits empty collections', async () => {
  const result = await collectionIndex({
    products: [{ collection: 'fine', images: [] }, { collection: 'fine', images: ['ribbon.jpg'] }, { collection: 'tools', images: ['spool.jpg'] }],
    pictures: [{ key: 'home_col_tools', url: 'studio.jpg' }],
  })
  assert.deepEqual(result.map(row => row.slug), ['fine', 'tools'])
  assert.deepEqual(result.map(row => row.count), [2, 1])
  assert.deepEqual(result.map(row => row.image), ['ribbon.jpg', 'studio.jpg'])
})

test('a failed catalog query cannot publish an empty collections landing page', async () => {
  await assert.rejects(collectionIndex({ error: { message: 'Database unavailable' } }), /Unable to load collections/)
})

test('temporary availability errors cannot mark a populated collection noindex', async () => {
  const prefix = read('app/collections/[slug]/page.jsx').split('export default async function CollectionPage')[0]
  const run = error => compile(prefix, {
    cache: fn => fn, COLLECTION_META: { fine: { name: 'Fine', desc: 'Fine ribbon' } },
    supabaseServer: { from: table => ({ select: () => ({ eq() { return this },
      single: async () => ({ data: null }), then(resolve) { return Promise.resolve({ count: error ? null : 0, error }).then(resolve) },
    }) }) },
  }, 'generateMetadata')({ params: { slug: 'fine' } })
  await assert.rejects(run({ message: 'Unavailable' }), /Unable to check collection/)
  assert.equal((await run(null)).robots.index, false, 'a genuinely empty collection remains noindex')
})
