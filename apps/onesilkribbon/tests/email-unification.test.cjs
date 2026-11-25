const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('all transactional email entry points use the shared Resend transport', () => {
  const email = read('lib/email.js')
  assert.match(email, /export async function sendEmail/)
  assert.match(email, /AbortSignal\.timeout/)
  assert.match(email, /Idempotency-Key/)
  for (const file of [
    'app/api/subscribe/route.js',
    'app/api/verify-email/route.js',
    'app/api/contact/route.js',
    'app/api/admin/send-email/route.js',
  ]) {
    const source = read(file)
    assert.match(source, /sendEmail/, file)
    assert.doesNotMatch(source, /api\.resend\.com/, file)
  }
})

function load(file, exported, bindings = {}) {
  const source = read(file).replace(/^import .*$/gm, '').replace(/^export /gm, '')
  return new Function(...Object.keys(bindings), source + '\nreturn ' + exported)(...Object.values(bindings))
}

function mailRoute(admin = { email: 'owner@example.test' }, storageBindings = {}, options = {}) {
  const messages = []
  const logs = []
  const sendEmail = load('lib/email.js', 'sendEmail', {
    process: { env: { RESEND_API_KEY: 'test-only' } },
    fetch: async (_, options) => {
      messages.push(JSON.parse(options.body))
      return Response.json({ id: 'mock-message' })
    },
    logEmail: async entry => { logs.push(entry) },
  })
  const POST = load('app/api/admin/send-email/route.js', 'POST', {
    verifyAdmin: async () => admin,
    siteConfig: { brand: 'Test Shop', ownerEmail: 'owner@example.test', siteUrl: 'https://shop.example.test' },
    escapeHtml: value => value.replace(/</g, '&lt;'),
    supabaseAdmin: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.subscriberStatus ? { status: options.subscriberStatus } : null,
              error: null,
            }),
          }),
        }),
      }),
    },
    errorResponse: error => { throw error },
    sendEmail,
    normalizeEmail: value => String(value || '').trim().toLowerCase(),
    unsubscribeHeaders: () => ({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }),
    unsubscribePageUrl: () => 'https://shop.example.test/unsubscribe?token=test',
    unsubscribeFooter: () => '<p>Unsubscribe</p>',
    auditEmail: () => 'email-hash',
    recordAdminAction: async () => {},
    validateEmailAttachments: load('admin/lib/email-attachments.js', 'validateEmailAttachments'),
    validateEmailAttachmentDetails: load('admin/lib/email-attachments.js', 'validateEmailAttachmentDetails'),
    ...storageBindings,
  })
  return { POST, messages, logs }
}

const fields = { to: 'buyer@example.test', subject: 'Order documents', body: 'Documents enclosed' }
const request = body => new Request('https://shop.example.test/api/admin/send-email', { method: 'POST', body })
function withAttachments(files) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  for (const file of files) form.append('attachments', file)
  return request(form)
}

test('admin multipart mail forwards original file names and bytes through the shared sender', async () => {
  const { POST, messages, logs } = mailRoute()
  const original = Buffer.from([0, 127, 128, 255])
  const res = await POST(withAttachments([
    new File([original], '发货凭证.pdf', { type: 'application/pdf' }),
    new File(['second'], 'note.txt', { type: 'text/plain' }),
  ]))
  assert.equal(res.status, 200)
  assert.deepEqual(messages[0].attachments.map(file => file.filename), ['发货凭证.pdf', 'note.txt'])
  assert.deepEqual(Buffer.from(messages[0].attachments[0].content, 'base64'), original)
  assert.equal(messages[0].cc, 'owner@example.test')
  assert.equal(logs[0].providerId, 'mock-message')
  assert.equal(Object.hasOwn(logs[0], 'attachments'), false)
})

test('admin marketing mail refuses an unsubscribed recipient unless it is tied to an order', async () => {
  const blocked = mailRoute(undefined, {}, { subscriberStatus: 'unsubscribed' })
  const refused = await blocked.POST(request(JSON.stringify(fields)))
  assert.equal(refused.status, 409)
  assert.equal(blocked.messages.length, 0)

  const allowed = mailRoute(undefined, {}, { subscriberStatus: 'unsubscribed' })
  const sent = await allowed.POST(request(JSON.stringify({ ...fields, orderNumber: 'OSR-1001' })))
  assert.equal(sent.status, 200)
  assert.equal(allowed.messages.length, 1)
  assert.equal(allowed.messages[0].to, fields.to)
})

test('admin rejects invalid attachment lists and the sender still accepts legacy JSON', async () => {
  const { POST, messages } = mailRoute()
  const limits = [
    [new File(['data'], 'script.exe')],
    [new File([], 'empty.txt')],
    Array.from({ length: 6 }, (_, i) => new File(['data'], `file-${i}.txt`)),
    ['not a file'],
  ]
  for (const files of limits) assert.equal((await POST(withAttachments(files))).status, 400)
  assert.equal((await POST(withAttachments([new File([Buffer.alloc(5 * 1024 * 1024)], 'large.pdf')]))).status, 413)
  const unauthorized = mailRoute(false)
  assert.equal((await unauthorized.POST(withAttachments([new File(['data'], 'safe.txt')]))).status, 401)
  assert.equal(unauthorized.messages.length, 0)
  assert.equal(messages.length, 0)
  assert.equal((await POST(request(JSON.stringify(fields)))).status, 200)
  assert.equal(Object.hasOwn(messages[0], 'attachments'), false)
})

test('large attachments bypass the send request body and use private, administrator-scoped storage', async () => {
  const { createHmac, randomUUID } = require('node:crypto')
  const id = randomUUID()
  const file = new Blob([Buffer.alloc(6 * 1024 * 1024, 7)])
  const reads = []
  const removed = []
  const storage = load('admin/lib/email-attachment-storage.js',
    '{ readEmailAttachments, removeEmailAttachmentUploads, validEmailAttachmentIds }', {
      createHmac, randomUUID,
      process: { env: { SUPABASE_SERVICE_KEY: 'test-only' } },
      EMAIL_ATTACHMENT_BUCKET: 'admin-email-attachments', MAX_EMAIL_ATTACHMENTS: 5,
      supabaseAdmin: { storage: { from(bucket) {
        assert.equal(bucket, 'admin-email-attachments')
        return {
          download: async path => { reads.push(path); return { data: file } },
          remove: async paths => { removed.push(...paths); return {} },
        }
      } } },
    })
  const { POST, messages } = mailRoute(undefined, storage)
  const attachment = { id, name: 'large.pdf', size: file.size }
  const payload = attachments => request(JSON.stringify({ ...fields, attachments }))
  assert.equal((await POST(payload([{ ...attachment, id: '../other-admin.pdf' }]))).status, 400)
  assert.equal((await POST(payload([{ ...attachment, size: 29 * 1024 * 1024 }]))).status, 400)
  assert.equal(reads.length, 0)
  assert.equal((await POST(payload([{ ...attachment, size: 1 }]))).status, 409)
  assert.equal(messages.length, 0)
  assert.equal((await POST(payload([attachment]))).status, 200)
  assert.equal(messages[0].attachments[0].filename, 'large.pdf')
  assert.ok(Buffer.from(messages[0].attachments[0].content, 'base64').equals(Buffer.from(await file.arrayBuffer())))
  const folder = createHmac('sha256', 'test-only').update('admin-email-attachments:owner@example.test').digest('hex')
  assert.deepEqual(removed, [folder + '/' + id])
})
