-- ═══════════════════════════════════════════
-- One Silk Ribbon — Supabase Database Schema
--
-- 新环境：先执行本文件，再按 supabase/migrations/MANIFEST.md 的顺序执行迁移。
-- 本文件只负责基础表、列、索引和 RLS；支付事务、退款、订阅、商品事务保存等
-- 由 migrations 补齐。
--
-- 本文件可重复执行：只使用 create ... if not exists / create or replace /
-- drop ... if exists，不会删除或改写现有业务数据。
-- ═══════════════════════════════════════════

-- ── PRODUCTS ──────────────────────────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  care_instructions text,
  collection text not null, -- 系列 slug，见 admin/site-config.js
  is_active boolean default true,
  is_featured boolean default false,
  images text[] default '{}',
  sort_order integer default 0,
  attribute_config jsonb default '[]'::jsonb,
  specifications jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── PRODUCT SKUS ──────────────────────────
create table if not exists product_skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  sku_code text unique not null,
  colour text not null,
  colour_hex text not null,
  width_mm integer,
  length_m integer default 10,
  price_gbp numeric(10,2) not null,
  stock_qty integer default 0,
  is_active boolean default true,
  attributes jsonb default '{}'::jsonb,
  images text[] default '{}',
  created_at timestamptz default now()
);

-- ── CUSTOMERS ─────────────────────────────
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  last_name text,
  phone text,
  is_guest boolean default false,
  created_at timestamptz default now()
);

-- ── ORDERS ────────────────────────────────
-- 线上 orders 还有 user_id / discount_gbp / phone / 取消与退款字段 / tracking_url。
-- 这些列在支付、退款、物流和 GDPR 删除代码里都在用，基线必须一并建出来。
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references customers(id),
  customer_email text not null,
  user_id uuid,
  status text default 'pending',
  subtotal_gbp numeric(10,2) not null,
  vat_amount_gbp numeric(10,2) default 0,
  shipping_gbp numeric(10,2) default 0,
  discount_gbp numeric(10,2) default 0,
  total_gbp numeric(10,2) not null,
  vat_rate numeric(5,2) default 20.00,
  shipping_name text not null,
  shipping_line1 text not null,
  shipping_line2 text,
  shipping_city text not null,
  shipping_postcode text not null,
  shipping_country text default 'GB',
  phone text,
  payment_method text,
  payment_intent_id text,
  paid_at timestamptz,
  shipped_from text,
  tracking_number text,
  tracking_carrier text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  refund_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── ORDER ITEMS ───────────────────────────
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  sku_id uuid references product_skus(id),
  product_name text not null,
  sku_description text not null,
  quantity integer not null,
  unit_price_gbp numeric(10,2) not null,
  line_total_gbp numeric(10,2) not null,
  created_at timestamptz default now()
);

-- ── TRACKING ──────────────────────────────
create table if not exists tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  tracking_number text not null,
  carrier text,
  status text not null,
  message text,
  location text,
  event_time timestamptz,
  created_at timestamptz default now()
);

-- ── NEWSLETTER（旧表，保留兼容）────────────
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subscribed_at timestamptz default now()
);

-- ── SETTINGS / COUPONS / CONTENT ──────────
create table if not exists settings (
  key text primary key,
  value text
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  discount_type text not null,
  discount_value numeric(10,2) not null,
  min_order_gbp numeric(10,2) default 0,
  max_uses integer,
  uses_count integer default 0,
  active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists user_profiles (
  id uuid primary key,
  email text,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists journal_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  category text,
  excerpt text,
  intro text,
  cover_image text,
  sections jsonb default '[]'::jsonb,
  closing text,
  read_time text,
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists site_images (
  key text primary key,
  url text,
  updated_at timestamptz default now()
);

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  status text default 'pending',
  verified boolean default false,
  verify_token text unique,
  token_expires_at timestamptz,
  coupon_code text,
  subscribed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text,
  first_name text,
  last_name text,
  line1 text,
  line2 text,
  city text,
  postcode text,
  country text default 'GB',
  phone text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  to_email text not null,
  subject text,
  order_number text,
  status text not null,
  error text,
  provider_id text,
  created_at timestamptz default now()
);

-- ── PAYPAL SESSION ────────────────────────
create table if not exists paypal_sessions (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  paypal_order_id text not null,
  items text not null,
  form text not null,
  totals text not null,
  user_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- ── MEDIA ─────────────────────────────────
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  path text not null,
  filename text,
  alt_text text,
  size_bytes integer,
  namespace text,
  created_at timestamptz default now()
);

-- ── INDEXES ───────────────────────────────
create index if not exists products_collection_idx on products(collection);
create index if not exists product_skus_product_id_idx on product_skus(product_id);
create index if not exists orders_customer_email_idx on orders(customer_email);
create index if not exists orders_status_idx on orders(status);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists tracking_events_order_id_idx on tracking_events(order_id);
create index if not exists email_log_created_at_idx on email_log(created_at desc);
create index if not exists email_log_to_email_idx on email_log(to_email);
create index if not exists email_log_order_number_idx on email_log(order_number);
create index if not exists journal_posts_published_at_idx on journal_posts(published_at desc);
create index if not exists user_addresses_user_id_idx on user_addresses(user_id);
create index if not exists media_created_at_idx on media(created_at desc);

-- ── CUSTOMER SUMMARY ──────────────────────
-- 后台客户列表用的聚合视图。与 2026-11-07-customer-identity.sql 保持一致：
-- orders 统计全部订单；spent 只统计已付款/已发货/已送达，和后台营收口径一致。
create or replace view customer_summary as
select
  coalesce(o.customer_email, 'unknown')                                        as email,
  (array_agg(o.shipping_name    order by o.created_at desc))[1]                as name,
  (array_agg(o.shipping_city    order by o.created_at desc))[1]                as city,
  (array_agg(o.shipping_country order by o.created_at desc))[1]                as country,
  count(*)::int                                                                as orders,
  coalesce(sum(o.total_gbp) filter (where o.status in ('paid','shipped','delivered')), 0)::numeric
                                                                               as spent,
  max(o.created_at)                                                            as last_order,
  (array_agg(o.user_id) filter (where o.user_id is not null))[1]               as user_id,
  (count(*) filter (where o.status in ('paid','shipped','delivered')))::int    as paid_orders
from orders o
group by coalesce(o.customer_email, 'unknown');

-- ── AUTO-UPDATE updated_at ────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute function update_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
  for each row execute function update_updated_at();

-- ── ORDER NUMBER GENERATOR（历史保留，当前订单号由应用生成）──
create or replace function generate_order_number()
returns text as $$
declare
  year text := to_char(now(), 'YYYY');
  seq int;
begin
  select count(*) + 1 into seq from orders
  where extract(year from created_at) = extract(year from now());
  return 'OSR-' || year || '-' || lpad(seq::text, 4, '0');
end;
$$ language plpgsql;

-- ── ROW LEVEL SECURITY ────────────────────
alter table products enable row level security;
alter table product_skus enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table customers enable row level security;
alter table settings enable row level security;
alter table coupons enable row level security;
alter table user_profiles enable row level security;
alter table journal_posts enable row level security;
alter table site_images enable row level security;
alter table subscribers enable row level security;
alter table tracking_events enable row level security;
alter table email_log enable row level security;
alter table user_addresses enable row level security;
alter table paypal_sessions enable row level security;
alter table newsletter_subscribers enable row level security;
alter table media enable row level security;

-- Public can read active products / SKUs.
drop policy if exists "Public read products" on products;
create policy "Public read products" on products for select using (is_active = true);
drop policy if exists "Public read skus" on product_skus;
create policy "Public read skus" on product_skus for select using (is_active = true);

-- ── ADMIN CHECK ───────────────────────────
-- ⚠️ 这里的邮箱必须与 .env 的 ADMIN_EMAILS 保持一致。
create or replace function is_admin_user()
returns boolean as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (
    array['song@onesilkribbon.com']
  )
$$ language sql stable;

-- orders / order_items：只允许管理员；正常业务走 service role。
drop policy if exists "Own orders" on orders;
drop policy if exists "Own order items" on order_items;
drop policy if exists "Admin manage orders" on orders;
drop policy if exists "Admin manage order items" on order_items;
create policy "Admin manage orders" on orders
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage order items" on order_items
  for all using (is_admin_user()) with check (is_admin_user());

-- 其余后台表：只允许管理员；所有正常读写走 service role。
drop policy if exists "Admin manage settings"        on settings;
drop policy if exists "Admin manage coupons"          on coupons;
drop policy if exists "Admin manage user_profiles"    on user_profiles;
drop policy if exists "Admin manage journal_posts"    on journal_posts;
drop policy if exists "Admin manage site_images"      on site_images;
drop policy if exists "Admin manage subscribers"      on subscribers;
drop policy if exists "Admin manage tracking_events"  on tracking_events;
drop policy if exists "Admin manage email_log"        on email_log;
drop policy if exists "Admin manage media"            on media;

create policy "Admin manage settings" on settings
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage coupons" on coupons
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage user_profiles" on user_profiles
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage journal_posts" on journal_posts
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage site_images" on site_images
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage subscribers" on subscribers
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage tracking_events" on tracking_events
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage email_log" on email_log
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage media" on media
  for all using (is_admin_user()) with check (is_admin_user());

-- 表级权限：匿名/登录用户不能直接读写这些表。
revoke all on settings         from anon, authenticated;
revoke all on coupons          from anon, authenticated;
revoke all on user_profiles    from anon, authenticated;
revoke all on site_images      from anon, authenticated;
revoke all on subscribers      from anon, authenticated;
revoke all on tracking_events  from anon, authenticated;
revoke all on email_log        from anon, authenticated;
revoke all on media            from anon, authenticated;
revoke all on paypal_sessions  from anon, authenticated;
revoke all on user_addresses   from anon, authenticated;
revoke all on customers        from anon, authenticated;
revoke all on orders, order_items, newsletter_subscribers from public, anon, authenticated;

-- 前台匿名读取在售商品/规格是公开能力；写操作仍由 service role 完成。
grant select on products, product_skus to anon, authenticated;

grant all on settings, coupons, user_profiles, site_images, subscribers,
  tracking_events, email_log, media, paypal_sessions, user_addresses, customers,
  orders, order_items, newsletter_subscribers, products, product_skus
  to service_role;
grant select on customer_summary to service_role;
revoke all on customer_summary from anon, authenticated;

notify pgrst, 'reload schema';
