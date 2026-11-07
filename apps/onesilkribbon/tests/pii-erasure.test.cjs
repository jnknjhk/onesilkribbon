const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

let db
const product = '20000000-0000-4000-8000-000000000001'
const sku = '20000000-0000-4000-8000-000000000002'
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const migration = file => read(path.join('supabase/migrations', file))
const rows = async sql => (await db.query(sql)).rows

const item = (qty = 2) => ({
  skuId: sku, productId: product, name: 'Silk', skuDesc: '7mm', qty, price: 10,
})
const order = number => ({
  order_number: number,
  customer_email: 'customer@example.com',
  user_id: null,
  subtotal_gbp: '20',
  shipping_gbp: '0',
  discount_gbp: '0',
  total_gbp: '20',
  shipping_name: 'Test Customer',
  shipping_line1: '1 Street',
  shipping_line2: 'Flat 2',
  shipping_city: 'London',
  shipping_postcode: 'A1 2BC',
  shipping_country: 'GB',
  phone: '+44 7700 900000',
  payment_method: 'stripe',
  couponCode: '',
})
const prepare = (number, qty = 2) => db.query(
  'select prepare_payment_checkout($1::jsonb,$2::jsonb)',
  [JSON.stringify(order(number)), JSON.stringify([item(qty)])]
)
const stock = async () => (await rows(`select stock_qty from product_skus where id='${sku}'`))[0].stock_qty

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select '{}'::jsonb
    $$;
  `)
  await db.exec(read('supabase/schema.sql'))
  for (const file of [
    '2026-10-14-payment-reliability.sql',
    '2026-10-14-inventory-coupons.sql',
    '2026-11-06-pii-erasure-and-order-closing.sql',
  ]) {
    await db.exec(migration(file))
  }
  await db.exec(`
    insert into products(id,name,slug,collection) values('${product}','Silk','silk','fine-silk-ribbons');
    insert into product_skus(id,product_id,sku_code,colour,colour_hex,price_gbp,stock_qty,is_active)
      values('${sku}','${product}','silk-7mm','Ivory','#fff',10,100,true);
  `)
})

after(async () => { await db?.close() })

test('customer erasure strips payment evidence PII but keeps money, IDs and rows', async () => {
  await prepare('privacy')

  const payload = {
    order: order('privacy'),
    items: [{ name: 'Silk', skuDesc: '7mm', qty: 2, price: 10 }],
  }
  await db.query(
    "insert into payment_notifications(order_number,payload) values('privacy',$1::jsonb)",
    [JSON.stringify(payload)]
  )
  await db.query(`insert into payment_receipts(provider,payment_id,order_number,amount_pence,currency,evidence)
    values('stripe','pi_privacy','privacy',2000,'GBP',$1::jsonb)`, [JSON.stringify({
    data: { object: { customer_details: { email: 'customer@example.com', name: 'Test Customer' } } },
  })])
  await db.query(`insert into paypal_sessions(order_number,paypal_order_id,items,form,totals,user_id,expires_at)
    values('privacy','PP1',$1,$2,$3,'30000000-0000-4000-8000-000000000001',now()+interval '1 hour')`, [
    JSON.stringify([item()]),
    JSON.stringify({ email: 'customer@example.com', firstName: 'Test', lastName: 'Customer' }),
    JSON.stringify({ total: '20.00' }),
  ])
  await db.query("update orders set notes='VIP customer@example.com' where order_number='privacy'")
  await db.query(`insert into refund_requests(order_id,manual,restock,reason)
    select id,true,true,'Customer asked for a refund: customer@example.com' from orders where order_number='privacy'`)
  await db.query(`insert into email_log(kind,to_email,subject,order_number,status)
    values('order_confirmation','customer@example.com','Order for Test Customer','privacy','sent')`)

  const { rows: result } = await db.query("select anonymize_customer_payment_evidence(array['privacy']) as n")
  assert.equal(result[0].n, 1)

  const checkout = (await rows("select snapshot from payment_checkouts where order_number='privacy'"))[0].snapshot
  assert.equal(checkout.order.customer_email, undefined)
  assert.equal(checkout.order.shipping_name, undefined)
  assert.equal(checkout.order.shipping_line1, undefined)
  assert.equal(checkout.order.shipping_city, undefined)
  assert.equal(checkout.order.shipping_postcode, undefined)
  assert.equal(checkout.order.phone, undefined)
  assert.equal(Number(checkout.order.total_gbp), 20)
  assert.equal(checkout.items[0].name, 'Silk')
  assert.equal(checkout.items[0].qty, 2)

  const notification = (await rows("select payload from payment_notifications where order_number='privacy'"))[0].payload
  assert.equal(notification.order.customer_email, undefined)
  assert.equal(notification.order.shipping_name, undefined)
  assert.equal(notification.items[0].name, 'Silk')

  const receipt = (await rows("select amount_pence, currency, payment_id, evidence from payment_receipts where order_number='privacy'"))[0]
  assert.equal(receipt.amount_pence, 2000)
  assert.equal(receipt.currency, 'GBP')
  assert.equal(receipt.payment_id, 'pi_privacy')
  assert.equal(receipt.evidence.anonymized, true)

  const session = (await rows("select form, user_id, items, totals from paypal_sessions where order_number='privacy'"))[0]
  assert.equal(JSON.parse(session.form).anonymized, true)
  assert.equal(session.user_id, null)
  assert.equal(session.items, JSON.stringify([item()]))
  assert.equal(session.totals, JSON.stringify({ total: '20.00' }))

  assert.equal((await rows("select notes from orders where order_number='privacy'"))[0].notes, null)
  assert.equal((await rows("select reason from refund_requests where order_id=(select id from orders where order_number='privacy')"))[0].reason, '[redacted]')
  const email = (await rows("select to_email, subject from email_log where order_number='privacy'"))[0]
  assert.equal(email.to_email, 'deleted-customer@invalid')
  assert.equal(email.subject, null)

  // 只脱敏，不删除任何一条业务/支付记录。
  for (const table of ['orders', 'order_items', 'payment_checkouts', 'payment_notifications', 'payment_receipts', 'paypal_sessions', 'refund_requests', 'email_log']) {
    const { n } = (await rows(`select count(*)::int n from ${table}`))[0]
    assert.ok(n > 0, `${table} should still have rows`)
  }
})

test('closing an unpaid order releases stock without deleting the order', async () => {
  await prepare('abandoned')
  assert.equal(await stock(), 96)

  await db.query("select close_unpaid_order('abandoned','test cleanup')")
  assert.equal(await stock(), 98)
  assert.equal((await rows("select status from orders where order_number='abandoned'"))[0].status, 'cancelled')
  assert.equal((await rows("select state from checkout_reservations where order_number='abandoned'"))[0].state, 'released')
  assert.equal((await rows("select count(*)::int n from order_items where order_id=(select id from orders where order_number='abandoned')"))[0].n, 1)
  assert.equal((await rows("select count(*)::int n from payment_checkouts where order_number='abandoned'"))[0].n, 1)

  // 幂等：第二次不会重复释放库存，也不会改动已取消订单。
  await db.query("select close_unpaid_order('abandoned','test cleanup')")
  assert.equal(await stock(), 98)
})

test('closing refuses an order that already has payment evidence', async () => {
  await prepare('paid-evidence')
  await db.query(`insert into payment_receipts(provider,payment_id,order_number,amount_pence,currency,evidence)
    values('stripe','pi_paid_evidence','paid-evidence',2000,'GBP','{}'::jsonb)`)
  await assert.rejects(
    db.query("select close_unpaid_order('paid-evidence','test cleanup')"),
    /payment_evidence_exists/
  )
  assert.equal((await rows("select status from orders where order_number='paid-evidence'"))[0].status, 'pending')
  assert.equal((await rows("select state from checkout_reservations where order_number='paid-evidence'"))[0].state, 'active')
})

test('closing refuses a capture already in progress', async () => {
  await prepare('capturing')
  await db.query("select begin_paypal_capture('capturing')")
  await assert.rejects(
    db.query("select close_unpaid_order('capturing','test cleanup')"),
    /Capture in progress/
  )
  assert.equal((await rows("select state from checkout_reservations where order_number='capturing'"))[0].state, 'capturing')
})

test('admin erasure and maintenance call the non-destructive database functions', () => {
  const erase = read('admin/api/customer-erase.js')
  const maintenance = read('admin/api/maintenance.js')
  assert.match(erase, /close_unpaid_order/)
  assert.match(erase, /anonymize_customer_payment_evidence/)
  assert.doesNotMatch(erase, /from\('orders'\)\s*\.delete/)
  assert.match(maintenance, /close_unpaid_order/)
  assert.doesNotMatch(maintenance, /from\('orders'\)\s*\.delete/)
})
