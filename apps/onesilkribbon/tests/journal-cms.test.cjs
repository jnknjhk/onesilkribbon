const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const app = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(app, file), 'utf8').replace(/\r\n/g, '\n')
const compile = (source, bindings, result) => new Function(...Object.keys(bindings),
  source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `;return ${result}`)(...Object.values(bindings))
const text = compile(read('lib/journal-text.js'), {}, '({safeJournalHref,journalInlineParts,journalTextBlocks,journalSections,usesAutumnLayout})')

test('CMS links allow web and local URLs but block executable, protocol-relative and obfuscated schemes', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//example.com', '/\\example.com', 'java\nscript:alert(1)', 'file:///secret', 'vbscript:run']) assert.equal(text.safeJournalHref(url), null)
  for (const url of ['https://onesilkribbon.com/ribbon-guide', '/journal', '#gifts']) assert.equal(text.safeJournalHref(url), url)
  assert.deepEqual(text.journalInlineParts('See [our guide](/ribbon-guide).'), [{ text: 'See ' }, { text: 'our guide', href: '/ribbon-guide' }, { text: '.' }])
  assert.deepEqual(text.journalInlineParts('<img src=x onerror=alert(1)>'), [{ text: '<img src=x onerror=alert(1)>' }])
})

test('CMS paragraphs and editable callouts preserve text, section order, images and unique anchors', () => {
  assert.deepEqual(text.journalTextBlocks('First\n\n> Planning\n> 2 m\n\nLast'), [
    { type: 'paragraph', text: 'First' }, { type: 'quote', lines: ['Planning', '2 m'] }, { type: 'paragraph', text: 'Last' },
  ])
  const post = { sections: [{ id: 'gifts', heading: 'Edited heading', body: 'Edited text', template: 'autumn' }, { id: 'gifts-2', type: 'image', url: '/new.jpg' }, { id: 'gifts', body: 'Another' }] }
  const sections = text.journalSections(post)
  assert.deepEqual(sections.map(s => s.id), ['gifts', 'gifts-2', 'gifts-3'])
  assert.equal(sections[0].body, 'Edited text')
  assert.equal(sections[1].url, '/new.jpg')
  assert.equal(text.usesAutumnLayout(post), true)
  assert.equal(text.usesAutumnLayout({ sections: null }), false)
})

test('editing or removing the original first section keeps the selected layout; switching to standard removes it', () => {
  const helpers = compile(fs.readFileSync(path.resolve(app, '../../packages/core/admin/lib/journal-content.js'), 'utf8'), {}, '({journalLayout,prepareJournalSections})')
  const original = { sections: [{ body: 'First', template: 'autumn' }, { heading: 'Second', body: 'Original' }] }
  const selectedLayout = helpers.journalLayout(original)
  const edited = [{ heading: 'Second', body: 'Edited text' }, { type: 'image', url: '/new-cover.jpg' }, { body: 'New paragraph' }, { body: ' ' }]
  const before = JSON.stringify(edited)
  const saved = helpers.prepareJournalSections(edited, selectedLayout)
  assert.equal(saved.length, 3)
  assert.equal(saved[0].body, 'Edited text')
  assert.ok(saved.every(section => section.template === 'autumn'))
  assert.equal(text.usesAutumnLayout({ sections: saved }), true)
  assert.ok(helpers.prepareJournalSections(saved, 'standard').every(section => !Object.hasOwn(section, 'template')))
  assert.equal(JSON.stringify(edited), before)
})

test('the Halloween URL uses the published CMS query; drafts, deletion and slug changes have no static fallback', async () => {
  assert.equal(fs.existsSync(path.join(app, 'app/journal/halloween-silk-ribbon-ideas/page.jsx')), false)
  const source = read('app/journal/[slug]/page.jsx')
  const start = source.indexOf('const getPost = cache')
  const query = source.slice(start, source.indexOf('\n})', start) + 3)
  let row = { slug: 'halloween-silk-ribbon-ideas', is_published: true, title: 'Edited title', sections: [{ template: 'autumn', body: 'Edited CMS paragraph' }] }
  const getPost = compile(query, { cache: f => f, supabaseServer: { from(table) {
    assert.equal(table, 'journal_posts')
    const filters = {}
    return { select() { return this }, eq(k, v) { filters[k] = v; return this }, async maybeSingle() { return { data: row && row.slug === filters.slug && row.is_published === filters.is_published ? row : null, error: null } } }
  } } }, 'getPost')
  assert.equal((await getPost(row.slug)).title, 'Edited title')
  assert.equal((await getPost(row.slug)).sections[0].body, 'Edited CMS paragraph')
  row.is_published = false
  assert.equal(await getPost(row.slug), null)
  row.is_published = true; row.slug = 'changed-slug'
  assert.equal(await getPost('halloween-silk-ribbon-ideas'), null)
  assert.equal((await getPost('changed-slug')).title, 'Edited title')
  row = null
  assert.equal(await getPost('changed-slug'), null)
})

function journalApi({ authorized = true, fail = false } = {}) {
  const writes = [], refreshes = []
  const supabase = { from: () => {
    const q = { insert(row) { writes.push(row); return q }, update(row) { writes.push(row); return q }, delete() { writes.push('delete'); return q }, eq() { return q }, select() { return q }, single() { return q }, then(resolve, reject) { return Promise.resolve(fail ? { error: { code: 'TEST_ERROR' } } : { data: { id: 'cms-id' }, error: null }).then(resolve, reject) } }
    return q
  } }
  const POST = compile(fs.readFileSync(path.resolve(app, '../../packages/core/admin/api/journal.js'), 'utf8'), {
    supabase, verifyAdmin: async () => authorized, errorResponse: () => Response.json({ error: 'retry' }, { status: 500 }), fetchAll() {}, revalidatePath: (...args) => refreshes.push(args),
  }, 'POST')
  return { writes, refreshes, post: body => POST({ json: async () => body }) }
}

test('saving content or publication state and deleting an article refresh the list, article routes and sitemap', async () => {
  for (const [action, published] of [['create', true], ['update', true], ['update', false], ['delete', false]]) {
    const h = journalApi()
    const post = { id: 'cms-id', slug: 'edited-slug', title: 'Edited', is_published: published, was_published: true, sections: [{ type: 'text', template: 'autumn', body: 'New CMS text' }] }
    assert.equal((await h.post({ action, post })).status, 200)
    assert.deepEqual(h.refreshes, [['/journal'], ['/journal/[slug]', 'page'], ['/sitemap.xml']])
    if (action !== 'delete') { assert.deepEqual(h.writes[0].sections, post.sections); assert.equal(h.writes[0].is_published, published); assert.ok(Number.isFinite(Date.parse(h.writes[0].updated_at))) }
  }
})

test('unauthorized or failed CMS writes do not invalidate public pages', async () => {
  const unauthorized = journalApi({ authorized: false })
  assert.equal((await unauthorized.post({ action: 'update', post: {} })).status, 401)
  assert.deepEqual(unauthorized.writes, []); assert.deepEqual(unauthorized.refreshes, [])
  for (const action of ['create', 'update', 'delete']) {
    const failed = journalApi({ fail: true })
    assert.equal((await failed.post({ action, post: { id: 'cms-id' } })).status, 500)
    assert.deepEqual(failed.refreshes, [])
  }
})
