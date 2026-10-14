const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')
let db
const token = 'a'.repeat(64)
const prepare = async (email = 'subscriber@example.org', nextToken = token) =>
  (await db.query('select prepare_subscription_email($1,$2,$3) result', [email, 'welcome_popup', nextToken])).rows[0].result
before(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table subscribers(id uuid primary key default gen_random_uuid(),email text unique,
      verify_token text,token_expires_at timestamptz,source text,status text,verified boolean default false);`)
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/2026-10-14-subscription-safety.sql'), 'utf8')
  await db.exec(sql)
  await db.exec(sql) // Safe to re-run after a dashboard retry.
})
after(async () => { await db?.close() })
beforeEach(async () => { await db.exec('truncate subscription_email_attempts,subscription_email_requests,subscribers') })

test('normalizes email and keeps valid token and unsent request on retry', async () => {
  const first = await prepare(' Subscriber@Example.ORG ')
  await db.exec("update subscription_email_attempts set created_at=now()-interval '2 minutes'")
  const retry = await prepare('subscriber@example.org', 'b'.repeat(64))
  assert.equal(first.email, 'subscriber@example.org')
  assert.equal(retry.id, first.id)
  assert.equal(retry.verify_token, token)
  assert.equal(retry.token_expires_at, first.token_expires_at)
})

test('rapid repeated requests permit only one send across parallel calls', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => prepare()))
  assert.equal(results.filter(value => !value.limited).length, 1)
  assert.equal((await db.query('select count(*)::int n from subscription_email_requests')).rows[0].n, 1)
})

test('daily email limit survives successful or failed sends', async () => {
  await prepare()
  await db.exec("update subscription_email_attempts set created_at=now()-interval '2 minutes'")
  await prepare()
  await db.exec("update subscription_email_attempts set created_at=now()-interval '2 minutes'")
  await prepare()
  await db.exec("update subscription_email_attempts set created_at=now()-interval '2 minutes'")
  assert.equal((await prepare()).retry_after, 86400)
})

test('global hourly cap stops a rotating-address flood before subscriber insertion', async () => {
  await db.exec("insert into subscription_email_attempts(email) select 'flood-'||n||'@example.org' from generate_series(1,100) n")
  assert.equal((await prepare()).limited, true)
  assert.equal((await db.query('select count(*)::int n from subscribers')).rows[0].n, 0)
})

test('verified subscribers are retained and no new verification mail is prepared', async () => {
  await db.exec("insert into subscribers(email,verified,status) values('subscriber@example.org',true,'active')")
  assert.deepEqual(await prepare(), { skip: true })
  assert.equal((await db.query('select count(*)::int n from subscription_email_requests')).rows[0].n, 0)
})

test('expired tokens rotate but unexpired links survive a deliberate resend', async () => {
  const first = await prepare()
  await db.query('update subscription_email_requests set sent_at=now() where id=$1', [first.id])
  await db.exec("update subscription_email_attempts set created_at=now()-interval '2 minutes'")
  const resend = await prepare(undefined, 'b'.repeat(64))
  assert.notEqual(resend.id, first.id)
  assert.equal(resend.verify_token, first.verify_token)
  await db.exec("update subscribers set token_expires_at=now()-interval '1 minute'; update subscription_email_attempts set created_at=now()-interval '2 minutes'")
  assert.equal((await prepare(undefined, 'c'.repeat(64))).verify_token, 'c'.repeat(64))
})

test('database failure rolls back subscriber, token change and rate accounting together', async () => {
  await db.exec(`create function reject_email_request() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end $$;
    create trigger reject_email_request before insert on subscription_email_requests for each row execute function reject_email_request();`)
  try {
    await assert.rejects(prepare(), /simulated failure/)
    assert.equal((await db.query('select count(*)::int n from subscribers')).rows[0].n, 0)
    assert.equal((await db.query('select count(*)::int n from subscription_email_attempts')).rows[0].n, 0)
  } finally { await db.exec('drop trigger reject_email_request on subscription_email_requests; drop function reject_email_request()') }
})

test('public users cannot call email preparation or read verification tokens', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("select has_function_privilege($1,'prepare_subscription_email(text,text,text)','execute') allowed", [role])).rows[0].allowed, false)
    assert.equal((await db.query("select has_table_privilege($1,'subscription_email_requests','select') allowed", [role])).rows[0].allowed, false)
  }
})

test('subscription endpoint fails closed and retries use a stable mail idempotency key', async () => {
  const originalFetch = global.fetch
  let dbError = true
  let fetches = 0
  const request = { id: 'request-1', email: 'subscriber@example.org', verify_token: token, created_at: '2026-10-14T00:00:00Z' }
  globalThis.__subscribeDb = {
    rpc: async () => dbError ? { error: { code: 'offline' } } : { data: request },
    from: () => ({ update: () => ({ eq: async () => ({}) }) }),
  }
  global.fetch = async (_url, options) => {
    fetches++
    assert.equal(options.headers['Idempotency-Key'], 'subscription/request-1')
    return new Response('{}', { status: 200 })
  }
  process.env.RESEND_API_KEY = 'test-only'
  const source = fs.readFileSync(path.join(__dirname, '../app/api/subscribe/route.js'), 'utf8')
    .replace("import { supabaseAdmin } from '@osr/core/lib/supabase'", 'const supabaseAdmin = globalThis.__subscribeDb')
    .replace("import { NextResponse } from 'next/server'", 'const NextResponse = Response')
  try {
    const { POST } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
    const req = body => new Request('https://example.org/api/subscribe', { method: 'POST', body: JSON.stringify(body) })
    assert.equal((await POST(req({ email: {} }))).status, 400)
    assert.equal((await POST(req({ email: 'subscriber@example.org' }))).status, 503)
    assert.equal(fetches, 0)
    dbError = false
    assert.equal((await POST(req({ email: 'subscriber@example.org' }))).status, 200)
    assert.equal(fetches, 1)
  } finally { global.fetch = originalFetch; delete globalThis.__subscribeDb }
})
