const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')

let db
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const migration = read('supabase/migrations/2026-11-08-admin-backoffice.sql')

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table orders (
      id uuid primary key default gen_random_uuid(),
      status text
    );
    create table products (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text unique not null,
      is_active boolean default true,
      images text[] default '{}',
      attribute_config jsonb default '[]'::jsonb,
      specifications jsonb default '[]'::jsonb
    );
    create table product_skus (
      id uuid primary key default gen_random_uuid(),
      product_id uuid references products(id),
      sku_code text unique not null,
      colour text not null,
      colour_hex text not null,
      attributes jsonb default '{}'::jsonb,
      stock_qty integer default 0,
      price_gbp numeric(10,2) not null,
      is_active boolean default true,
      images text[] default '{}'
    );
    create table site_images (key text primary key, url text);
    create table journal_posts (
      id uuid primary key default gen_random_uuid(),
      title text,
      cover_image text,
      sections jsonb default '[]'::jsonb
    );
  `)
  await db.exec(migration)
})

after(async () => { await db?.close() })

test('admin_order_status_counts returns one aggregate instead of six count queries', async () => {
  await db.exec("insert into orders(status) values ('paid'),('paid'),('shipped'),('pending'),('cancelled')")
  const { rows } = await db.query('select admin_order_status_counts() as counts')
  assert.deepEqual(rows[0].counts, { paid: 2, shipped: 1, pending: 1, cancelled: 1 })
})

test('admin_stock_page searches product names beyond the old 100-product cap', async () => {
  await db.exec(`
    insert into products(name, slug)
      select 'Bulk ' || lpad(i::text, 3, '0'), 'bulk-' || i
        from generate_series(1, 120) i;
  `)
  const bulk120 = (await db.query("select id from products where slug='bulk-120'")).rows[0].id
  const bulk1 = (await db.query("select id from products where slug='bulk-1'")).rows[0].id
  const bulk2 = (await db.query("select id from products where slug='bulk-2'")).rows[0].id

  await db.exec(`
    insert into product_skus(product_id, sku_code, colour, colour_hex, stock_qty, price_gbp)
      values
        ('${bulk1}', 'SKU-001', 'Ivory', '#fff', 10, 10),
        ('${bulk2}', 'SKU-002', 'Ivory', '#fff', 2, 10),
        ('${bulk120}', 'SKU-120', 'Crimson', '#900', 0, 10);
  `)

  const search = async (q, filter = '', limit = 30, offset = 0) =>
    (await db.query('select admin_stock_page($1,$2,3,$3,$4) as r', [q, filter, limit, offset])).rows[0].r

  // 商品名命中第 120 个商品时也必须返回它的 SKU（旧实现只取前 100 个商品）
  const far = await search('Bulk 120')
  assert.equal(far.total, 1)
  assert.equal(far.skus[0].sku_code, 'SKU-120')
  assert.equal(far.skus[0].products.name, 'Bulk 120')

  // 颜色、SKU 编码也能搜；大小写不敏感
  assert.equal((await search('ivory')).total, 2)
  assert.equal((await search('sku-002')).total, 1)

  // 库存筛选与分页
  assert.equal((await search('', 'low')).total, 2) // SKU-002（2）和 SKU-120（0）
  assert.equal((await search('', 'out')).total, 1) // 只有 SKU-120 库存为 0
  const page1 = await search('', '', 1, 0)
  const page2 = await search('', '', 1, 1)
  assert.equal(page1.total, 3)
  assert.equal(page1.skus[0].sku_code, 'SKU-001')
  assert.equal(page2.skus[0].sku_code, 'SKU-002')

  // 参数上限/下限保护
  const clamped = await search('', '', 999, -5)
  assert.equal(clamped.skus.length, 3)
})

test('admin_media_usage finds references in arrays and jsonb without loading tables into Node', async () => {
  const url = 'https://cdn.example.com/media/hero.jpg'
  await db.exec(`
    update products set images = array['${url}'] where slug='bulk-1';
    insert into site_images(key, url) values ('home_hero_1', '${url}');
    insert into journal_posts(title, cover_image, sections)
      values ('Story', '${url}', '[]'::jsonb),
             ('Sections', null, '[{"image":"${url}"}]'::jsonb);
  `)
  const { rows } = await db.query('select admin_media_usage($1) as labels', [url])
  const labels = rows[0].labels
  assert.ok(labels.includes('商品「Bulk 001」'))
  assert.ok(labels.includes('网站图片 home_hero_1'))
  assert.ok(labels.includes('文章「Story」'))
  assert.ok(labels.includes('文章「Sections」'))

  const { rows: empty } = await db.query("select admin_media_usage('') as labels")
  assert.deepEqual(empty[0].labels, [])
})

test('customer erasure calls the transactional function and keeps a fallback', () => {
  const erase = read('admin/api/customer-erase.js')
  assert.match(erase, /admin_erase_customer_data/)
  assert.match(erase, /eraseCustomerLegacy/)
  assert.match(erase, /close_unpaid_order/)
})
