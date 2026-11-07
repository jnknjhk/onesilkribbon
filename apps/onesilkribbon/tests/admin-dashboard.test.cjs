const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

let db
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
  await db.exec(read('supabase/migrations/2026-11-07-admin-dashboard.sql'))
  await db.exec(`
    insert into settings(key,value) values ('low_stock_threshold','2');
    insert into products(id,name,slug,collection,is_active) values
      ('30000000-0000-4000-8000-000000000001','Active','active','fine-silk-ribbons',true),
      ('30000000-0000-4000-8000-000000000002','Inactive','inactive','fine-silk-ribbons',false);
    insert into product_skus(id,product_id,sku_code,colour,colour_hex,price_gbp,stock_qty,is_active) values
      ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','s1','One','#fff',10,1,true),
      ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','s2','Two','#fff',10,5,true),
      ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','s3','Three','#fff',10,0,false),
      ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002','s4','Four','#fff',10,0,true);
    insert into orders(order_number,customer_email,status,subtotal_gbp,total_gbp,
      shipping_name,shipping_line1,shipping_city,shipping_postcode,created_at,paid_at) values
      ('o1','a@example.com','paid',10,10,'One','1 Street','London','A1 1AA',now(),now()),
      ('o2','a@example.com','shipped',20,20,'Two','1 Street','London','A1 1AA',now()-interval '3 days',now()-interval '4 days'),
      ('o3','a@example.com','delivered',30,30,'Three','1 Street','London','A1 1AA',now()-interval '40 days',now()-interval '41 days'),
      ('o4','a@example.com','pending',40,40,'Four','1 Street','London','A1 1AA',now(),null),
      ('o5','a@example.com','paid',50,50,'Five','1 Street','London','A1 1AA',now()-interval '3 days',now()-interval '3 days'),
      ('o6','a@example.com','cancelled',60,60,'Six','1 Street','London','A1 1AA',now()-interval '5 days',null);
    insert into order_items(order_id,product_id,sku_id,product_name,sku_description,quantity,unit_price_gbp,line_total_gbp)
      select id,'30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Silk','7mm',1,10,10
        from orders where order_number in ('o1','o2','o3');
    insert into email_log(kind,to_email,status,created_at) values
      ('contact','a@example.com','failed',now()-interval '1 day'),
      ('contact','a@example.com','failed',now()-interval '10 days'),
      ('contact','a@example.com','sent',now()-interval '1 day');
  `)
})

after(async () => { await db?.close() })

test('dashboard aggregation keeps the previous counts and paid-only sales rules', async () => {
  const result = (await rows('select admin_dashboard() as data'))[0].data
  assert.deepEqual(result.todo, {
    toShip: 2,
    toShipOverdue: 1,
    lowStock: 1,
    lowStockThreshold: 2,
    needsReview: 1,
    failedEmails: 1,
  })
  assert.deepEqual(result.sales.today, { revenue: 10, orders: 1 })
  assert.deepEqual(result.sales.d7, { revenue: 80, orders: 3 })
  assert.deepEqual(result.sales.d30, { revenue: 80, orders: 3 })
  assert.deepEqual(result.sales.all, { revenue: 110, orders: 4 })
  assert.equal(result.productsActive, 1)
  assert.equal(result.recent.length, 6)
})

test('admin dashboard route returns the aggregate and fails closed', async () => {
  const payload = { todo: { toShip: 2 }, sales: { today: { revenue: 10, orders: 1 } }, productsActive: 1, recent: [] }
  const GET = load('admin/api/dashboard.js', {
    supabaseAdmin: { rpc: async name => { assert.equal(name, 'admin_dashboard'); return { data: payload, error: null } } },
    verifyAdmin: async () => ({ email: 'admin@example.com' }),
    errorResponse: () => Response.json({ error: 'retry' }, { status: 500 }),
  }, 'GET')
  const response = await GET()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), payload)

  const failing = load('admin/api/dashboard.js', {
    supabaseAdmin: { rpc: async () => ({ data: null, error: new Error('offline') }) },
    verifyAdmin: async () => ({ email: 'admin@example.com' }),
    errorResponse: () => Response.json({ error: 'retry' }, { status: 500 }),
  }, 'GET')
  assert.equal((await failing()).status, 500)
})
