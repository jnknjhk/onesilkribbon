const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

let db
const user = '11111111-1111-4111-8111-111111111111'
const otherUser = '22222222-2222-4222-8222-222222222222'
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const rows = async sql => (await db.query(sql)).rows
const load = (file, bindings, name) => {
  const source = read(file).replace(/^import .*$/gm, '').replace(/^export async function/gm, 'async function').replace(/^export (?=const |function )/gm, '')
  return new Function(...Object.keys(bindings), source + `;return ${name}`)(...Object.values(bindings))
}

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  `)
  await db.exec(read('supabase/schema.sql'))
  await db.exec(read('supabase/migrations/2026-11-07-customer-identity.sql'))
  await db.exec(`
    insert into orders(order_number,customer_email,user_id,status,subtotal_gbp,total_gbp,
      shipping_name,shipping_line1,shipping_city,shipping_postcode,created_at) values
      ('g1','Guest@Example.com',null,'paid',10,10,'Guest One','1 Street','London','A1 1AA','2026-01-01'),
      ('g2','guest@example.com',null,'pending',20,20,'Guest Two','2 Street','London','A1 1AA','2026-01-02'),
      ('g3','other@example.com',null,'paid',30,30,'Other','3 Street','London','A1 1AA','2026-01-03'),
      ('g4','guest@example.com','${otherUser}','paid',40,40,'Guest Four','4 Street','London','A1 1AA','2026-01-04'),
      ('v1','view@example.com',null,'paid',10,10,'View One','5 Street','London','A1 1AA','2026-02-01'),
      ('v2','view@example.com',null,'shipped',20,20,'View Two','5 Street','London','A1 1AA','2026-02-02'),
      ('v3','view@example.com',null,'pending',30,30,'View Three','5 Street','London','A1 1AA','2026-02-03'),
      ('v4','view@example.com',null,'cancelled',40,40,'View Four','5 Street','London','A1 1AA','2026-02-04');
  `)
})

after(async () => { await db?.close() })

test('claiming guest orders links only matching unowned email orders and is idempotent', async () => {
  const first = (await rows(`select claim_guest_orders('${user}',' Guest@Example.com ') as n`))[0].n
  assert.equal(first, 2)
  const owners = Object.fromEntries((await rows(
    "select order_number,user_id from orders where order_number like 'g%' order by order_number"
  )).map(row => [row.order_number, row.user_id]))
  assert.equal(owners.g1, user)
  assert.equal(owners.g2, user)
  assert.equal(owners.g3, null)
  assert.equal(owners.g4, otherUser)

  const second = (await rows(`select claim_guest_orders('${user}','guest@example.com') as n`))[0].n
  assert.equal(second, 0)
  await assert.rejects(db.query(`select claim_guest_orders('${user}','not-an-email')`), /invalid_claim/)
  await assert.rejects(db.query("select claim_guest_orders(null,'guest@example.com')"), /invalid_claim/)
})

test('customer summary counts all orders but spends only paid, shipped and delivered ones', async () => {
  const summary = (await rows("select orders, paid_orders, spent from customer_summary where email='view@example.com'"))[0]
  assert.equal(summary.orders, 4)
  assert.equal(summary.paid_orders, 2)
  assert.equal(Number(summary.spent), 30)
})

test('claimGuestOrders requires a confirmed email and never lets an RPC failure block the account page', async () => {
  let calls = 0
  const claim = load('lib/user-records.js', {
    supabaseAdmin: { rpc: async (name, params) => { calls++; assert.equal(name, 'claim_guest_orders'); return { data: 2, error: null } } },
  }, 'claimGuestOrders')

  assert.equal(await claim({ id: user, email: 'guest@example.com', email_confirmed_at: '2026-01-01' }), 2)
  assert.equal(calls, 1)
  assert.equal(await claim({ id: user, email: 'guest@example.com' }), 0)
  assert.equal(calls, 1)

  const failing = load('lib/user-records.js', {
    supabaseAdmin: { rpc: async () => ({ data: null, error: new Error('offline') }) },
  }, 'claimGuestOrders')
  assert.equal(await failing({ id: user, email: 'guest@example.com', confirmed_at: '2026-01-01' }), 0)
})
