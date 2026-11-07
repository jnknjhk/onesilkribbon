const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

let db
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, 'supabase', file), 'utf8')
const rows = async sql => (await db.query(sql)).rows

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
  await db.exec(read('schema.sql'))
  await db.exec(read('migrations/2026-10-14-payment-reliability.sql'))
  await db.exec(read('migrations/2026-10-14-inventory-coupons.sql'))
  await db.exec(read('migrations/2026-11-07-customer-identity.sql'))
  await db.exec(read('migrations/2026-11-07-payment-refunds.sql'))
  await db.exec(`
    insert into orders(order_number,customer_email,status,subtotal_gbp,total_gbp,
      shipping_name,shipping_line1,shipping_city,shipping_postcode) values
      ('OSR-FULL','refund@example.com','paid',20,20,'Refund Customer','1 Street','London','A1 1AA'),
      ('OSR-PART','refund@example.com','paid',50,50,'Refund Customer','1 Street','London','A1 1AA');
  `)
})

after(async () => { await db?.close() })

test('full external refund marks the order refunded once, without touching stock', async () => {
  const first = (await rows(
    "select record_external_refund('stripe','re_full','OSR-FULL','pi_full',2000,'gbp',true) as result"
  ))[0].result
  assert.equal(first.already, false)
  assert.equal(first.order_status, 'refunded')

  const order = (await rows("select status,refund_reason,total_gbp from orders where order_number='OSR-FULL'"))[0]
  assert.equal(order.status, 'refunded')
  assert.equal(order.refund_reason, '支付平台退款（外部）')
  assert.equal(Number(order.total_gbp), 20)

  const refundRequest = (await rows("select manual,restock,provider_id,provider_status,completed_at from refund_requests where order_id=(select id from orders where order_number='OSR-FULL')"))[0]
  assert.equal(refundRequest.manual, true)
  assert.equal(refundRequest.restock, false)
  assert.equal(refundRequest.provider_id, 're_full')
  assert.equal(refundRequest.provider_status, 'succeeded')
  assert.ok(refundRequest.completed_at)

  const stored = (await rows("select amount_pence,currency,full_refund,processed_at from payment_refunds where provider='stripe' and refund_id='re_full'"))[0]
  assert.equal(Number(stored.amount_pence), 2000)
  assert.equal(stored.currency, 'GBP')
  assert.equal(stored.full_refund, true)
  assert.ok(stored.processed_at)

  const again = (await rows(
    "select record_external_refund('stripe','re_full','OSR-FULL','pi_full',2000,'gbp',true) as result"
  ))[0].result
  assert.equal(again.already, true)
  assert.equal((await rows("select count(*)::int n from payment_refunds where refund_id='re_full'"))[0].n, 1)
})

test('partial external refund is recorded without changing the order state', async () => {
  const result = (await rows(
    "select record_external_refund('paypal','re_part','OSR-PART','CAP-PART',1000,'gbp',false) as result"
  ))[0].result
  assert.equal(result.already, false)
  assert.equal(result.order_status, 'paid')
  assert.equal((await rows("select status from orders where order_number='OSR-PART'"))[0].status, 'paid')
  assert.equal((await rows("select count(*)::int n from refund_requests where order_id=(select id from orders where order_number='OSR-PART')"))[0].n, 0)
  assert.equal((await rows("select count(*)::int n from payment_refunds where refund_id='re_part'"))[0].n, 1)
})

test('invalid refunds are rejected before writing', async () => {
  await assert.rejects(db.query(
    "select record_external_refund('stripe','re_bad','OSR-FULL','pi',0,'gbp',true)"
  ), /invalid_refund/)
  await assert.rejects(db.query(
    "select record_external_refund('other','re_bad','OSR-FULL','pi',100,'gbp',true)"
  ), /invalid_refund/)
  await assert.rejects(db.query(
    "select record_external_refund('stripe','re_missing','OSR-MISSING','pi',100,'gbp',true)"
  ), /order_not_found/)
  assert.equal((await rows("select count(*)::int n from payment_refunds where refund_id like 're_%' and refund_id in ('re_bad','re_missing')"))[0].n, 0)
})
