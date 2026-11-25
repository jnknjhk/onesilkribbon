const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

// lib/unsubscribe.js 是 ESM；测试沿用项目里的做法：去掉 import/export 后注入依赖执行。
function loadUnsubscribe() {
  const source = read('lib/unsubscribe.js')
    .replace(/^import .*$/gm, '')
    .replace(/^export (?=const |function |async function)/gm, '')
  return new Function('crypto', source + `;return {
    normalizeEmail, unsubscribeToken, verifyUnsubscribeToken,
    unsubscribePageUrl, unsubscribeApiUrl, unsubscribeHeaders
  }`)(crypto)
}

const u = loadUnsubscribe()

test('email normalisation is trim + lowercase', () => {
  assert.equal(u.normalizeEmail('  Buyer@Example.COM '), 'buyer@example.com')
  assert.equal(u.normalizeEmail(null), '')
  assert.equal(u.normalizeEmail(123), '')
})

test('unsubscribe token is deterministic, per-email and tamper-evident', () => {
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
  const a = u.unsubscribeToken('Buyer@Example.com')
  assert.match(a, /^[a-f0-9]{40}$/)
  assert.equal(a, u.unsubscribeToken('  buyer@example.com '))
  assert.notEqual(a, u.unsubscribeToken('other@example.com'))

  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', a), true)
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', a.replace(/.$/, '0')), false)
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', ''), false)
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', a.slice(0, 20)), false)

  // 换密钥后旧链接失效（部署时轮换 UNSUBSCRIBE_SECRET 的预期行为）。
  process.env.UNSUBSCRIBE_SECRET = 'different-secret'
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', a), false)
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
})

test('links point at the human page and the one-click API, with encoded email', () => {
  const page = u.unsubscribePageUrl('Buyer+Tag@Example.com', 'https://onesilkribbon.com/')
  assert.match(page, /^https:\/\/onesilkribbon\.com\/unsubscribe\?/)
  assert.match(page, /email=buyer%2Btag%40example\.com/)
  assert.match(page, /token=[a-f0-9]{40}$/)

  const api = u.unsubscribeApiUrl('buyer@example.com', 'https://onesilkribbon.com')
  assert.match(api, /^https:\/\/onesilkribbon\.com\/api\/unsubscribe\?/)

  const headers = u.unsubscribeHeaders('buyer@example.com', 'https://onesilkribbon.com')
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.match(headers['List-Unsubscribe'], /^<https:\/\/onesilkribbon\.com\/api\/unsubscribe\?/)
})

test('malformed and multibyte tokens are rejected without throwing', () => {
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', 'é'.repeat(40)), false)
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', 'z'.repeat(40)), false)
  assert.equal(u.verifyUnsubscribeToken('buyer@example.com', 'a'.repeat(39)), false)
  assert.doesNotThrow(() => u.verifyUnsubscribeToken('buyer@example.com', 'é'.repeat(40)))
})

test('production without a signing secret fails closed instead of using a public fallback', () => {
  const previous = {
    secret: process.env.UNSUBSCRIBE_SECRET,
    service: process.env.SUPABASE_SERVICE_KEY,
    env: process.env.NODE_ENV,
  }
  delete process.env.UNSUBSCRIBE_SECRET
  delete process.env.SUPABASE_SERVICE_KEY
  process.env.NODE_ENV = 'production'
  try {
    assert.equal(u.unsubscribeToken('buyer@example.com'), '')
    assert.equal(u.verifyUnsubscribeToken('buyer@example.com', 'a'.repeat(40)), false)
  } finally {
    if (previous.secret === undefined) delete process.env.UNSUBSCRIBE_SECRET
    else process.env.UNSUBSCRIBE_SECRET = previous.secret
    if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_KEY
    else process.env.SUPABASE_SERVICE_KEY = previous.service
    if (previous.env === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous.env
  }
})

test('marketing mail and unsubscribe route are wired together', () => {
  const sendEmail = read('app/api/admin/send-email/route.js')
  assert.match(sendEmail, /unsubscribeFooter/)
  assert.match(sendEmail, /unsubscribeHeaders/)
  assert.match(sendEmail, /unsubscribePageUrl/)
  assert.match(sendEmail, /recordAdminAction\(admin, 'email\.send'/)
  assert.match(sendEmail, /subjectLength/)
  assert.doesNotMatch(sendEmail, /detail: \{ subject,/)

  const route = read('app/api/unsubscribe/route.js')
  assert.match(route, /export async function POST/)
  assert.match(route, /status: 'unsubscribed'/)
  assert.match(route, /verifyUnsubscribeToken/)
  // 没有订阅记录的人也要落一条退订，并清掉旧订阅表
  assert.match(route, /insert\(\{ email: normalized, status: 'unsubscribed'/)
  assert.match(route, /newsletter_subscribers/)

  const emailLib = read('lib/email.js')
  assert.match(emailLib, /\.\.\.\(headers && Object\.keys\(headers\)\.length \? \{ headers \} : \{\}\)/)
})
