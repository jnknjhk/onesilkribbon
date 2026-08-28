-- ═══════════════════════════════════════════════════════════════════════════
-- One Glass Object — Supabase 数据库建表脚本
--
-- 这份脚本是 2026-08-27 按线上库的实际结构重写的，和代码里真正用到的表、
-- 字段一一对应。在新建的 Supabase 项目里打开 SQL Editor，把整份粘进去执行
-- 一次即可。可以重复执行（全部用了 if not exists / or replace）。
--
-- ⚠️ 执行前请先把最下面 is_admin_user() 里的管理员邮箱改成你自己的，
--    并保持和 .env 里的 ADMIN_EMAILS 一致。
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── 商品 ───────────────────────────────────────────────────────────────────
create table if not exists products (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text unique not null,
  description       text,
  care_instructions text,
  collection        text not null,               -- 对应 config/site.js 里 COLLECTIONS 的 slug
  is_active         boolean default true,
  is_featured       boolean default false,
  images            text[] default '{}',
  attribute_config  jsonb  default '[]'::jsonb,  -- 规格定义，形如 [{"name":"SIZE","options":["S","M"]}]
  specifications    jsonb  default '[]'::jsonb,  -- 商品参数表，形如 [{"key":"材质","value":"手工吹制玻璃"}]
  sort_order        integer default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 商品变体。没有规格的商品也要挂一个 SKU（价格和库存都记在 SKU 上），
-- 前台发现某个商品只有一个 SKU 时会自动不显示规格选择器。
create table if not exists product_skus (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid references products(id) on delete cascade,
  sku_code    text not null,
  colour      text not null default '默认',
  colour_hex  text not null default '#CCCCCC',
  width_mm    integer,
  length_m    integer,
  price_gbp   numeric(10,2) not null,
  stock_qty   integer default 0,
  is_active   boolean default true,
  attributes  jsonb default '{}'::jsonb,   -- 实际规格存这里，形如 {"SIZE":"M","COLOUR":"Amber"}
  images      jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

-- ── 客户 ───────────────────────────────────────────────────────────────────
create table if not exists customers (
  id         uuid primary key default uuid_generate_v4(),
  email      text not null unique,
  first_name text,
  last_name  text,
  phone      text,
  is_guest   boolean default true,
  user_id    uuid,
  created_at timestamptz default now()
);

-- 注册用户的资料（id 就是 Supabase Auth 里的用户 id）
create table if not exists user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  first_name text,
  last_name  text,
  phone      text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_addresses (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text,
  first_name text,
  last_name  text,
  line1      text not null,
  line2      text,
  city       text not null,
  postcode   text,
  country    text,
  phone      text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 订单 ───────────────────────────────────────────────────────────────────
create table if not exists orders (
  id                uuid primary key default uuid_generate_v4(),
  order_number      text not null unique,
  customer_id       uuid references customers(id),
  user_id           uuid,
  customer_email    text not null,
  customer_phone    text,
  phone             text,
  status            text default 'pending',
  subtotal_gbp      numeric(10,2) not null,
  discount_gbp      numeric(10,2) default 0,
  vat_amount_gbp    numeric(10,2) default 0,
  shipping_gbp      numeric(10,2) default 0,
  total_gbp         numeric(10,2) not null,
  vat_rate          numeric(5,2)  default 20,
  shipping_name     text not null,
  shipping_line1    text not null,
  shipping_line2    text,
  shipping_city     text not null,
  shipping_postcode text not null,
  shipping_country  text default 'GB',
  payment_method    text,
  payment_intent_id text,
  paid_at           timestamptz,
  shipped_from      text,
  tracking_number   text,
  tracking_carrier  text,
  carrier           text,
  tracking_url      text,
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  cancel_reason     text,
  cancelled_at      timestamptz,
  refund_reason     text,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists order_items (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid references orders(id) on delete cascade,
  product_id      uuid references products(id),
  sku_id          uuid references product_skus(id),
  product_name    text not null,
  sku_description text not null,
  quantity        integer not null,
  unit_price_gbp  numeric(10,2) not null,
  line_total_gbp  numeric(10,2) not null,
  created_at      timestamptz default now()
);

-- PayPal 从下单到付款成功之间的临时会话，付款完成后即可清理
create table if not exists paypal_sessions (
  id              uuid primary key default uuid_generate_v4(),
  order_number    text not null unique,
  paypal_order_id text not null,
  items           jsonb not null,
  form            jsonb not null,
  totals          jsonb not null,
  user_id         uuid,
  expires_at      timestamptz not null,
  created_at      timestamptz default now()
);

create table if not exists tracking_events (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid references orders(id) on delete cascade,
  tracking_number text not null,
  carrier         text,
  status          text not null,
  message         text,
  location        text,
  event_time      timestamptz,
  created_at      timestamptz default now()
);

-- ── 营销 ───────────────────────────────────────────────────────────────────
create table if not exists coupons (
  id             uuid primary key default uuid_generate_v4(),
  code           text not null unique,
  description    text,
  discount_type  text not null,          -- 'percentage' | 'fixed'
  discount_value numeric(10,2) not null,
  min_order_gbp  numeric(10,2) default 0,
  max_uses       integer,
  uses_count     integer default 0,
  active         boolean default true,
  expires_at     timestamptz,
  created_at     timestamptz default now()
);

create table if not exists subscribers (
  id               uuid primary key default uuid_generate_v4(),
  email            text not null unique,
  source           text,
  status           text default 'pending',
  verified         boolean default false,
  verify_token     text,
  token_expires_at timestamptz,
  coupon_code      text,
  subscribed_at    timestamptz,
  created_at       timestamptz default now()
);

-- ── 站点内容与配置 ──────────────────────────────────────────────────────────
-- 后台"设置"页读写的键值表，比如运费、包邮门槛
create table if not exists settings (
  key   text primary key,
  value text not null
);

-- 首页轮播、系列封面、About 配图等由后台指定位置的图片
create table if not exists site_images (
  id         uuid primary key default uuid_generate_v4(),
  key        text not null unique,
  url        text,
  label      text,
  updated_at timestamptz default now()
);

-- 统一媒体库（后台上传的图片，文件本身存在 storage 的 media bucket 里）
create table if not exists media (
  id         uuid primary key default uuid_generate_v4(),
  url        text not null,
  path       text not null,
  filename   text,
  alt_text   text,
  size_bytes integer,
  namespace  text,
  created_at timestamptz default now()
);

-- ── 索引 ───────────────────────────────────────────────────────────────────
create index if not exists idx_products_collection  on products(collection);
create index if not exists idx_products_slug        on products(slug);
create index if not exists idx_product_skus_product on product_skus(product_id);
create index if not exists idx_orders_email         on orders(customer_email);
create index if not exists idx_orders_number        on orders(order_number);
create index if not exists idx_orders_status        on orders(status);
create index if not exists idx_orders_user          on orders(user_id);
create index if not exists idx_order_items_order    on order_items(order_id);
create index if not exists idx_user_addresses_user  on user_addresses(user_id);
create index if not exists idx_media_namespace      on media(namespace);

-- ── 图片存储桶 ─────────────────────────────────────────────────────────────
-- 后台上传的图片都放这个 bucket，设为 public 让前台能直接用 URL 显示
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 权限
--
-- 说明：站点所有查询都走服务端的 service_role key（绕过 RLS），由代码自己做
-- 过滤和鉴权。下面开启 RLS 并只放行管理员，是为了万一 anon key 泄露，浏览器
-- 端拿着它也读不到订单和客户数据。
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠️ 把下面的邮箱换成你自己的管理员邮箱；多个就写成 array['a@x.com','b@x.com']，
--    并保持和 .env 里的 ADMIN_EMAILS 一致。
create or replace function is_admin_user()
returns boolean as $fn$
  select coalesce(auth.jwt() ->> 'email', '') = any (
    array['jnknjhk@gmail.com']  -- 本站管理员邮箱
  )
$fn$ language sql stable;

-- 商品类：任何人可读（仅上架的），只有管理员能写
alter table products     enable row level security;
alter table product_skus enable row level security;

drop policy if exists "Public read active products" on products;
create policy "Public read active products" on products
  for select using (is_active = true);
drop policy if exists "Admin manage products" on products;
create policy "Admin manage products" on products
  for all using (is_admin_user()) with check (is_admin_user());

drop policy if exists "Public read active skus" on product_skus;
create policy "Public read active skus" on product_skus
  for select using (is_active = true);
drop policy if exists "Admin manage skus" on product_skus;
create policy "Admin manage skus" on product_skus
  for all using (is_admin_user()) with check (is_admin_user());

-- 站点配置类：任何人可读，只有管理员能写
alter table settings    enable row level security;
alter table site_images enable row level security;

drop policy if exists "Public read settings" on settings;
create policy "Public read settings" on settings for select using (true);
drop policy if exists "Admin manage settings" on settings;
create policy "Admin manage settings" on settings
  for all using (is_admin_user()) with check (is_admin_user());

drop policy if exists "Public read site_images" on site_images;
create policy "Public read site_images" on site_images for select using (true);
drop policy if exists "Admin manage site_images" on site_images;
create policy "Admin manage site_images" on site_images
  for all using (is_admin_user()) with check (is_admin_user());

-- 用户自己的资料和地址：只能读写自己的那份
alter table user_profiles  enable row level security;
alter table user_addresses enable row level security;

drop policy if exists "Own profile" on user_profiles;
create policy "Own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Admin manage user_profiles" on user_profiles;
create policy "Admin manage user_profiles" on user_profiles
  for all using (is_admin_user()) with check (is_admin_user());

drop policy if exists "Own addresses" on user_addresses;
create policy "Own addresses" on user_addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admin manage user_addresses" on user_addresses;
create policy "Admin manage user_addresses" on user_addresses
  for all using (is_admin_user()) with check (is_admin_user());

-- 订单、客户、营销、日志：一律只有管理员能碰
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table customers       enable row level security;
alter table paypal_sessions enable row level security;
alter table tracking_events enable row level security;
alter table coupons         enable row level security;
alter table subscribers     enable row level security;
alter table media           enable row level security;

do $do$
declare t text;
begin
  foreach t in array array[
    'orders','order_items','customers','paypal_sessions',
    'tracking_events','coupons','subscribers','media'
  ] loop
    execute format('drop policy if exists "Admin manage %1$s" on %1$I', t);
    execute format(
      'create policy "Admin manage %1$s" on %1$I for all using (is_admin_user()) with check (is_admin_user())',
      t
    );
  end loop;
end $do$;

-- ── 初始设置项 ─────────────────────────────────────────────────────────────
insert into settings (key, value) values
  ('shipping_rate',           '5.90'),
  ('free_shipping_threshold', '45'),
  ('free_shipping_enabled',   'true')
on conflict (key) do nothing;
