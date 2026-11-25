const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

let db
const buyer = '50000000-0000-4000-8000-000000000001'
const zero = '50000000-0000-4000-8000-000000000002'
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const migration = file => read(path.join('supabase/migrations', file))
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
  await db.exec(read('supabase/schema.sql'))
  for (const file of [
    '2026-09-02-customer-summary.sql',
    '2026-10-14-payment-reliability.sql',
    '2026-10-14-inventory-coupons.sql',
    '2026-10-14-subscription-safety.sql',
    '2026-11-06-pii-erasure-and-order-closing.sql',
    '2026-11-07-customer-identity.sql',
    '2026-11-08-admin-backoffice.sql',
    '2026-11-25-customer-directory-and-erasure.sql',
  ]) {
    await db.exec(migration(file))
  }
  await db.exec(`
    insert into user_profiles(id,email,first_name) values
      ('${buyer}','buyer@example.com','Buyer'),
      ('${zero}','zero@example.com','Zero');
    insert into user_addresses(user_id,line1,city,postcode) values
      ('${buyer}','1 St','London','A1 1AA'),
      ('${zero}','2 St','London','A1 1AA');
    insert into subscribers(email,status,verified) values
      ('subscriber@example.com','active',true),
      ('optedout@example.com','unsubscribed',true);
    insert into newsletter_subscribers(email) values ('legacy@example.com');
    insert into subscription_email_requests(email,verify_token,token_expires_at)
      values ('buyer@example.com','tok-1',now()+interval '1 hour');
    insert into subscription_email_attempts(email) values ('buyer@example.com');
    insert into orders(order_number,customer_email,user_id,status,subtotal_gbp,total_gbp,
      shipping_name,shipping_line1,shipping_city,shipping_postcode,paid_at) values
      ('A1','Buyer@Example.com','${buyer}','paid',10,10,'Buyer','1 St','London','A1 1AA',now()),
      ('B1','other@example.com','${buyer}','paid',20,20,'Buyer','1 St','London','A1 1AA',now()),
      ('Z1','unrelated@example.com',null,'paid',30,30,'Other','3 St','London','A1 1AA',now());
  `)
})

after(async () => { await db?.close() })

test('customer directory includes zero-order accounts and subscribers', async () => {
  const list = Object.fromEntries((await rows(
    "select email, orders, has_account, subscribed from customer_directory where email in ('buyer@example.com','zero@example.com','subscriber@example.com','other@example.com')"
  )).map(r => [r.email, r]))

  assert.equal(list['buyer@example.com'].orders, 1)
  assert.equal(list['buyer@example.com'].has_account, true)
  assert.equal(list['zero@example.com'].orders, 0)
  assert.equal(list['zero@example.com'].has_account, true)
  assert.equal(list['subscriber@example.com'].subscribed, true)
  assert.equal(list['other@example.com'].orders, 1)
})

test('directory subscribed flag respects unsubscribe status and legacy subscribers', async () => {
  const list = Object.fromEntries((await rows(
    "select email, subscribed from customer_directory where email in ('subscriber@example.com','optedout@example.com','legacy@example.com')"
  )).map(r => [r.email, r.subscribed]))
  assert.equal(list['subscriber@example.com'], true)
  assert.equal(list['optedout@example.com'], false)
  assert.equal(list['legacy@example.com'], true)
})

test('erasure anonymises orders linked by user_id even when the checkout email differs', async () => {
  const { rows: result } = await db.query(
    "select admin_erase_customer_data('BUYER@EXAMPLE.COM', array[$1]::uuid[], array['A1']) as r",
    [buyer]
  )
  assert.equal(Number(result[0].r.anonymizedOrders), 2) // A1 + B1（同一账号，结账邮箱不同）

  for (const number of ['A1', 'B1']) {
    const order = (await rows(`select customer_email, shipping_name, user_id from orders where order_number='${number}'`))[0]
    assert.equal(order.customer_email, 'deleted-customer@invalid')
    assert.equal(order.shipping_name, '已删除的客户')
    assert.equal(order.user_id, null)
  }
  // 无关订单不受影响
  assert.equal((await rows("select customer_email from orders where order_number='Z1'"))[0].customer_email, 'unrelated@example.com')

  assert.equal((await rows(`select count(*)::int n from user_profiles where id='${buyer}'`))[0].n, 0)
  assert.equal((await rows(`select count(*)::int n from user_addresses where user_id='${buyer}'`))[0].n, 0)
  // 订阅限流历史里的邮箱也要清掉
  assert.equal((await rows("select count(*)::int n from subscription_email_requests where email='buyer@example.com'"))[0].n, 0)
  assert.equal((await rows("select count(*)::int n from subscription_email_attempts where email='buyer@example.com'"))[0].n, 0)
})

test('erasure can delete an account with zero orders', async () => {
  const { rows: result } = await db.query(
    "select admin_erase_customer_data('zero@example.com', array[$1]::uuid[], '{}'::text[]) as r",
    [zero]
  )
  assert.equal(Number(result[0].r.anonymizedOrders), 0)
  assert.equal((await rows(`select count(*)::int n from user_profiles where id='${zero}'`))[0].n, 0)
  assert.equal((await rows(`select count(*)::int n from user_addresses where user_id='${zero}'`))[0].n, 0)
  // 其他订单不受影响
  assert.equal((await rows("select count(*)::int n from orders where customer_email <> 'deleted-customer@invalid'"))[0].n, 1)
})

test('erasure can remove a subscriber who never ordered', async () => {
  await db.query("select admin_erase_customer_data('subscriber@example.com', '{}'::uuid[], '{}'::text[])")
  assert.equal((await rows("select count(*)::int n from subscribers where email='subscriber@example.com'"))[0].n, 0)
})

test('erasure can remove a legacy newsletter-only contact', async () => {
  await db.query("select admin_erase_customer_data('legacy@example.com', '{}'::uuid[], '{}'::text[])")
  assert.equal((await rows("select count(*)::int n from newsletter_subscribers where email='legacy@example.com'"))[0].n, 0)
})
