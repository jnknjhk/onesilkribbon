const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

let db
const migrations = [
  '2026-09-02-customer-summary.sql',
  '2026-09-02-email-log.sql',
  '2026-09-30-security-and-atomicity.sql',
  '2026-10-14-payment-reliability.sql',
  '2026-10-14-inventory-coupons.sql',
  '2026-10-14-subscription-safety.sql',
  '2026-10-16-audit-security.sql',
  '2026-11-06-baseline-completion.sql',
  '2026-11-06-product-save-atomic.sql',
  '2026-11-06-admin-performance-indexes.sql',
  '2026-11-06-pii-erasure-and-order-closing.sql',
  '2026-11-07-customer-identity.sql',
  '2026-11-07-payment-refunds.sql',
]

const read = file => fs.readFileSync(path.join(__dirname, '..', 'supabase', file), 'utf8')

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb
    );
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select '{}'::jsonb
    $$;
  `)
  // 空库先跑基线，再按 MANIFEST 的顺序跑迁移。
  await db.exec(read('schema.sql'))
  for (const file of migrations) {
    await db.exec(read(path.join('migrations', file)))
  }
})

after(async () => { await db?.close() })

const rows = async sql => (await db.query(sql)).rows

test('new database can be bootstrapped from schema.sql plus migrations', async () => {
  const orderColumns = new Set((await rows(
    "select column_name from information_schema.columns where table_schema='public' and table_name='orders'"
  )).map(r => r.column_name))
  for (const column of [
    'user_id', 'discount_gbp', 'phone', 'cancel_reason', 'cancelled_at',
    'refund_reason', 'tracking_url',
  ]) {
    assert.ok(orderColumns.has(column), `orders.${column} is missing`)
  }

  const productColumns = new Set((await rows(
    "select column_name from information_schema.columns where table_schema='public' and table_name='products'"
  )).map(r => r.column_name))
  for (const column of ['sort_order', 'attribute_config', 'specifications']) {
    assert.ok(productColumns.has(column), `products.${column} is missing`)
  }

  const skuColumns = new Set((await rows(
    "select column_name from information_schema.columns where table_schema='public' and table_name='product_skus'"
  )).map(r => r.column_name))
  for (const column of ['attributes', 'images']) {
    assert.ok(skuColumns.has(column), `product_skus.${column} is missing`)
  }

  assert.ok((await rows("select to_regclass('public.customer_summary') as value"))[0].value)
  assert.ok((await rows("select to_regprocedure('public.prepare_payment_checkout(jsonb,jsonb)') as value"))[0].value)
  assert.ok((await rows("select to_regprocedure('public.close_unpaid_order(text,text)') as value"))[0].value)
  assert.ok((await rows("select to_regprocedure('public.anonymize_customer_payment_evidence(text[])') as value"))[0].value)
  assert.ok((await rows("select to_regprocedure('public.claim_guest_orders(uuid,text)') as value"))[0].value)
  assert.ok((await rows("select to_regprocedure('public.record_external_refund(text,text,text,text,bigint,text,boolean,jsonb)') as value"))[0].value)
})

test('baseline keeps public catalog readable and orders private', async () => {
  const result = (await rows(`select
    has_table_privilege('anon','products','select') as anon_products,
    has_table_privilege('anon','orders','select') as anon_orders,
    has_table_privilege('authenticated','orders','select') as user_orders
  `))[0]
  assert.deepEqual(result, { anon_products: true, anon_orders: false, user_orders: false })
})

test('schema.sql and the new additive migrations are repeatable', async () => {
  await db.exec(read('schema.sql'))
  await db.exec(read('migrations/2026-11-06-baseline-completion.sql'))
  await db.exec(read('migrations/2026-11-06-pii-erasure-and-order-closing.sql'))
  assert.ok((await rows("select to_regclass('public.customer_summary') as value"))[0].value)
})
