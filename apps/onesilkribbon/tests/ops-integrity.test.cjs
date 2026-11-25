const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function manifestMigrations() {
  const text = read('supabase/migrations/MANIFEST.md')
  return [...text.matchAll(/^\|\s*\d+\s*\|\s*`([^`]+\.sql)`\s*\|/gm)].map(m => m[1])
}

function diskMigrations() {
  return fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
}

test('MANIFEST lists every migration exactly once, in a runnable order list', () => {
  const manifest = manifestMigrations()
  const disk = diskMigrations()
  assert.deepEqual([...manifest].sort(), disk)
  assert.equal(new Set(manifest).size, manifest.length, 'MANIFEST 里有重复文件')
  assert.ok(manifest.includes('2026-11-25-payment-disputes.sql'))
  assert.ok(manifest.includes('2026-11-25-customer-directory-and-erasure.sql'))
  // 已知的执行顺序依赖（文件名排序不成立）
  assert.ok(manifest.indexOf('2026-10-14-inventory-coupons.sql') > manifest.indexOf('2026-10-14-payment-reliability.sql'))
})

test('bootstrap test runs the same migrations as MANIFEST', () => {
  const source = read('tests/database-bootstrap.test.cjs')
  const listed = [...source.matchAll(/'([0-9][^']*\.sql)'/g)].map(m => m[1])
  assert.deepEqual(listed, manifestMigrations())
})

test('backup and restore share one table list and include money/audit tables', async () => {
  const { TABLES } = await import('../scripts/backup-tables.mjs')
  const names = TABLES.map(t => t.name)
  for (const required of [
    'orders', 'order_items', 'products', 'product_skus',
    'payment_refunds', 'payment_disputes', 'payment_receipts',
    'refund_requests', 'admin_audit_log', 'checkout_requests',
  ]) {
    assert.ok(names.includes(required), `备份清单缺少 ${required}`)
  }
  assert.equal(new Set(names).size, names.length, '备份清单有重复表')

  assert.match(read('scripts/backup-export.mjs'), /from '\.\/backup-tables\.mjs'/)
  assert.match(read('scripts/restore-import.mjs'), /from '\.\/backup-tables\.mjs'/)
})

test('escapeLike neutralises SQL and PostgREST wildcards', () => {
  const source = read('admin/api/_helpers.js').replace(/^export /gm, '')
  const { escapeLike } = new Function(source + ';return { escapeLike }')()
  assert.equal(escapeLike('a*b_c%d\\e@x.com'), 'a\\*b\\_c\\%d\\\\e@x.com')
  assert.equal(escapeLike(null), '')
})

test('P0 compliance and money paths stay wired', () => {
  assert.match(read('admin/api/customers.js'), /from\('customer_directory'\)/)
  assert.match(read('admin/api/customers.js'), /escapeLike/)
  // 路由层必须把 PATCH 暴露出去，否则后台按钮 405
  assert.match(read('app/api/admin/subscribers/route.js'), /export \{ GET, PATCH \}/)

  const stripe = read('app/api/stripe/webhook/route.js')
  assert.match(stripe, /charge\.dispute\./)
  assert.match(stripe, /recordAndNotifyDispute/)
  const paypal = read('app/api/paypal/webhook/route.js')
  assert.match(paypal, /CUSTOMER\.DISPUTE\./)
  assert.match(paypal, /recordAndNotifyDispute/)

  const send = read('app/api/admin/send-email/route.js')
  assert.match(send, /unsubscribeHeaders/)
  assert.match(send, /unsubscribeFooter/)
  assert.match(send, /recordAdminAction\(admin, 'email\.send'/)
  assert.match(send, /subjectLength/)

  assert.match(read('admin/api/subscribers.js'), /export async function PATCH/)
  assert.match(read('admin/api/subscribers.js'), /subscriber\.unsubscribe/)
  // 代码先于迁移上线时，支付恢复页不能整页 500
  assert.match(read('app/api/admin/payment-recovery/route.js'), /isMissingRelation/)
  // 未订阅过的人点退订也要落一条记录
  assert.match(read('app/api/unsubscribe/route.js'), /newsletter_subscribers/)
})

test('CI no longer skips the production build when secrets are missing', () => {
  const ci = read('../../.github/workflows/ci.yml')
  assert.doesNotMatch(ci, /跳过构建/)
  assert.match(ci, /检查构建所需密钥/)
  assert.match(ci, /exit 1/)
  assert.match(ci, /run: npm test/)
})

test('deployment docs cover the required environment variables', () => {
  const deploy = read('DEPLOY.md')
  for (const key of [
    'ADMIN_EMAILS', 'RESEND_API_KEY', 'EMAIL_FROM', 'UNSUBSCRIBE_SECRET',
    'NEXT_PUBLIC_SENTRY_DSN', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_WEBHOOK_ID',
  ]) {
    assert.match(deploy, new RegExp(key))
  }
  assert.doesNotMatch(deploy, /最后执行 `2026-11-06-pii-erasure-and-order-closing\.sql`/)
  assert.match(deploy, /restore-import|npm run restore/)
})
