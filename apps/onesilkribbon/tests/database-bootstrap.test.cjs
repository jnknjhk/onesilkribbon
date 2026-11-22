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
  '2026-11-07-admin-dashboard.sql',
  '2026-11-20-payment-recovery-fixes.sql',
  '2026-11-21-checkout-requests.sql',
  '2026-11-23-internal-product-names.sql',
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
  assert.ok((await rows("select to_regprocedure('public.admin_dashboard()') as value"))[0].value)
})

test('baseline keeps public catalog readable and orders private', async () => {
  const result = (await rows(`select
    has_table_privilege('anon','products','select') as anon_products,
    has_table_privilege('anon','orders','select') as anon_orders,
    has_table_privilege('authenticated','orders','select') as user_orders
  `))[0]
  assert.deepEqual(result, { anon_products: true, anon_orders: false, user_orders: false })
})

test('internal product names and their owner configuration are private', async () => {
  const result = await rows(`select c.relname, c.relrowsecurity as rls,
    has_table_privilege('anon', c.oid, 'select') as guest,
    has_table_privilege('authenticated', c.oid, 'select') as customer,
    has_table_privilege('service_role', c.oid, 'select') as server_read,
    has_table_privilege('service_role', c.oid, 'update') as server_write
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('product_internal_names','product_internal_name_access')
    order by c.relname`)
  assert.deepEqual(result, [
    { relname: 'product_internal_name_access', rls: true, guest: false, customer: false, server_read: true, server_write: false },
    { relname: 'product_internal_names', rls: true, guest: false, customer: false, server_read: true, server_write: true },
  ])
})

test('schema.sql and the new additive migrations are repeatable', async () => {
  await db.exec(read('schema.sql'))
  await db.exec(read('migrations/2026-11-06-baseline-completion.sql'))
  await db.exec(read('migrations/2026-11-06-pii-erasure-and-order-closing.sql'))
  assert.ok((await rows("select to_regclass('public.customer_summary') as value"))[0].value)
})

test('checkout claims are unique across requests and private to the service', async () => {
  const results = await Promise.allSettled(['first', 'second'].map(order =>
    db.query("insert into checkout_requests(request_key, order_number) values ('same-key', $1)", [order])))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.code, '23505')
  assert.deepEqual(await rows(`select has_table_privilege('anon','checkout_requests','select') as guest,
    has_table_privilege('authenticated','checkout_requests','select') as customer`), [{ guest: false, customer: false }])
})

test('Stripe retries preserve canonical refund IDs and count each partial refund once', async () => {
  await db.exec(`insert into orders(order_number,customer_email,status,subtotal_gbp,total_gbp,
    payment_method,shipping_name,shipping_line1,shipping_city,shipping_postcode)
    values ('partial-stripe','buyer@example.test','paid',20,20,'stripe','Buyer','1 Road','London','SW1A 2AA')`)
  const record = async (id, amount) => (await db.query(`select record_external_refund(
    'stripe',$1,'partial-stripe','pi_stripe',$2,'GBP',false) as result`, [id, amount])).rows[0].result
  assert.equal((await record('re_first', 1200)).order_status, 'paid')
  assert.equal((await record('re_first', 1200)).already, true)
  assert.equal((await record('re_second', 800)).order_status, 'refunded')
  assert.equal((await record('re_second', 800)).already, true)
  assert.deepEqual(await rows(`select count(*)::int as count, sum(amount_pence)::int as amount
    from payment_refunds where order_number='partial-stripe'`), [{ count: 2, amount: 2000 }])
})
