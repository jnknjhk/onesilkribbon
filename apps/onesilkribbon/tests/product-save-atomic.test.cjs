const { test, before } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')

let db
const migration = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/2026-11-06-product-save-atomic.sql'),
  'utf8'
)

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table products (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text unique not null,
      description text,
      care_instructions text,
      collection text not null,
      is_active boolean default true,
      is_featured boolean default false,
      images text[] default '{}',
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      sort_order integer default 0,
      attribute_config jsonb default '[]'::jsonb,
      specifications jsonb default '[]'::jsonb
    );
    create table product_skus (
      id uuid primary key default gen_random_uuid(),
      product_id uuid references products(id) on delete cascade,
      sku_code text unique not null,
      colour text not null,
      colour_hex text not null,
      width_mm integer,
      length_m integer,
      price_gbp numeric(10,2) not null,
      stock_qty integer default 0,
      is_active boolean default true,
      created_at timestamptz default now(),
      attributes jsonb default '{}'::jsonb,
      images text[] default '{}'
    );
    create table order_items (
      id uuid primary key default gen_random_uuid(),
      order_id uuid,
      product_id uuid,
      sku_id uuid,
      quantity int
    );
  `)
  await db.exec(migration)
})

const createProduct = async (slug, extra = {}) => {
  const product = {
    name: `Product ${slug}`,
    slug,
    description: 'Description',
    collection: 'fine-silk-ribbons',
    is_active: true,
    is_featured: false,
    sort_order: 1,
    images: ['main.jpg'],
    attribute_config: [{ name: '颜色', options: [{ value: 'Red' }] }],
    specifications: [{ key: 'Material', value: 'Silk' }],
    ...extra,
  }
  const skus = [
    {
      attributes: { 颜色: 'Red', 宽度: '10' },
      colour: 'Red',
      colour_hex: '#FF0000',
      price_gbp: '9.00',
      stock_qty: 4,
      is_active: true,
      images: ['red.jpg'],
    },
    {
      attributes: { 颜色: 'Blue' },
      colour: 'Blue',
      colour_hex: '#0000FF',
      price_gbp: '10.00',
      stock_qty: 2,
      is_active: true,
      images: [],
    },
  ]
  const result = await db.query(
    'select admin_save_product($1::jsonb,$2::jsonb,$3::jsonb) result',
    [JSON.stringify(product), JSON.stringify(skus), '[]']
  )
  return result.rows[0].result
}

test('admin_save_product creates the product and all SKUs in one transaction', async () => {
  const created = await createProduct('created-product')
  const product = (await db.query('select * from products where id=$1', [created.id])).rows[0]
  const skus = (await db.query('select * from product_skus where product_id=$1 order by colour', [created.id])).rows

  assert.equal(product.slug, 'created-product')
  assert.deepEqual(product.images, ['main.jpg'])
  assert.deepEqual(product.attribute_config, [{ name: '颜色', options: [{ value: 'Red' }] }])
  assert.equal(skus.length, 2)
  assert.ok(skus.every(sku => sku.sku_code.startsWith('created-product-')))
  const red = skus.find(sku => sku.colour === 'Red')
  assert.equal(red.width_mm, 10)
  assert.equal(red.length_m, null)
  assert.deepEqual(red.images, ['red.jpg'])
  assert.deepEqual(red.attributes, { 颜色: 'Red', 宽度: '10' })
})

test('admin_save_product updates product fields and preserves omitted fields', async () => {
  const created = await createProduct('update-product')
  const skus = (await db.query('select * from product_skus where product_id=$1 order by colour', [created.id])).rows
  const red = skus.find(sku => sku.colour === 'Red')

  await db.query(
    'select admin_save_product($1::jsonb,$2::jsonb,$3::jsonb)',
    [
      JSON.stringify({ id: created.id, name: 'Renamed', slug: 'update-product', images: ['new.jpg'] }),
      JSON.stringify([{
        id: red.id,
        loaded_stock_qty: 4,
        stock_qty: 7,
        colour: 'Red',
        colour_hex: '#EE0000',
        attributes: { 颜色: 'Red' },
        price_gbp: '11.00',
        is_active: true,
        images: ['updated.jpg'],
      }]),
      '[]',
    ]
  )

  const product = (await db.query('select * from products where id=$1', [created.id])).rows[0]
  const updated = (await db.query('select * from product_skus where id=$1', [red.id])).rows[0]
  assert.equal(product.name, 'Renamed')
  assert.equal(product.description, 'Description')
  assert.deepEqual(product.images, ['new.jpg'])
  assert.equal(updated.stock_qty, 7)
  assert.equal(updated.price_gbp, '11.00')
  assert.equal(updated.width_mm, null)
  assert.deepEqual(updated.images, ['updated.jpg'])
})

test('stock conflict rolls back the whole save, including product fields', async () => {
  const created = await createProduct('conflict-product')
  const sku = (await db.query('select * from product_skus where product_id=$1 order by colour limit 1', [created.id])).rows[0]
  await db.query('update product_skus set stock_qty=5 where id=$1', [sku.id])

  await assert.rejects(
    db.query(
      'select admin_save_product($1::jsonb,$2::jsonb,$3::jsonb)',
      [
        JSON.stringify({ id: created.id, name: 'Should Roll Back', slug: 'conflict-product' }),
        JSON.stringify([{
          id: sku.id,
          loaded_stock_qty: 4,
          stock_qty: 7,
          price_gbp: '99.00',
          colour: sku.colour,
          colour_hex: sku.colour_hex,
          attributes: sku.attributes,
          is_active: true,
        }]),
        '[]',
      ]
    ),
    /stock_conflict/
  )

  const product = (await db.query('select * from products where id=$1', [created.id])).rows[0]
  const unchanged = (await db.query('select * from product_skus where id=$1', [sku.id])).rows[0]
  assert.equal(product.name, 'Product conflict-product')
  assert.equal(unchanged.stock_qty, 5)
  assert.equal(unchanged.price_gbp, sku.price_gbp)
})

test('removing a SKU with order history deactivates it; unused SKUs are deleted', async () => {
  const created = await createProduct('delete-sku-product')
  const skus = (await db.query('select * from product_skus where product_id=$1 order by colour', [created.id])).rows
  const [red, blue] = skus

  await db.query(
    'insert into order_items(order_id,product_id,sku_id,quantity) values(gen_random_uuid(),$1,$2,1)',
    [created.id, red.id]
  )

  const result = await db.query(
    'select admin_save_product($1::jsonb,$2::jsonb,$3::jsonb) result',
    [JSON.stringify({ id: created.id }), '[]', JSON.stringify([red.id, red.id, blue.id])]
  )
  assert.equal(result.rows[0].result.deactivated, 1)
  assert.equal(result.rows[0].result.deleted, 1)

  const remaining = (await db.query('select * from product_skus where product_id=$1', [created.id])).rows
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].id, red.id)
  assert.equal(remaining[0].is_active, false)
})

test('changing a slug records the old slug redirect in the same transaction', async () => {
  const created = await createProduct('old-slug')
  await db.query(
    'select admin_save_product($1::jsonb,$2::jsonb,$3::jsonb)',
    [JSON.stringify({ id: created.id, slug: 'new-slug' }), '[]', '[]']
  )

  const map = JSON.parse((await db.query("select value from settings where key='product_slug_redirects'")).rows[0].value)
  assert.equal(map['old-slug'], created.id)
  assert.equal(map['new-slug'], undefined)
})

test('admin_delete_product soft-deletes when history exists and hard-deletes otherwise', async () => {
  const hard = await createProduct('hard-delete-product')
  const hardResult = await db.query('select admin_delete_product($1) result', [hard.id])
  assert.equal(hardResult.rows[0].result.softDeleted, false)
  assert.equal((await db.query('select count(*)::int n from products where id=$1', [hard.id])).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from product_skus where product_id=$1', [hard.id])).rows[0].n, 0)

  const soft = await createProduct('soft-delete-product')
  const sku = (await db.query('select * from product_skus where product_id=$1 limit 1', [soft.id])).rows[0]
  // 只靠 sku_id 关联的历史记录也必须阻止物理删除
  await db.query(
    'insert into order_items(order_id,product_id,sku_id,quantity) values(gen_random_uuid(),null,$1,1)',
    [sku.id]
  )
  const softResult = await db.query('select admin_delete_product($1) result', [soft.id])
  assert.equal(softResult.rows[0].result.softDeleted, true)
  const product = (await db.query('select * from products where id=$1', [soft.id])).rows[0]
  const skus = (await db.query('select * from product_skus where product_id=$1', [soft.id])).rows
  assert.equal(product.is_active, false)
  assert.ok(skus.every(row => row.is_active === false))
})
