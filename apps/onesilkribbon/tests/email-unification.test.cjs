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
