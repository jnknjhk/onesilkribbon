-- ═══════════════════════════════════════════
-- One Silk Ribbon — Supabase Database Schema
-- ═══════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PRODUCTS ──────────────────────────────
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  description text,
  care_instructions text,
  collection text not null, -- fine-silk, hand-frayed, adornments, patterned, studio-tools, vintage
  is_active boolean default true,
  is_featured boolean default false,
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── PRODUCT SKUS ──────────────────────────
create table product_skus (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  sku_code text unique not null,
  colour text not null,
  colour_hex text not null,
  width_mm integer, -- 2, 4, 7, 10, 25, 38, 50 etc
  length_m integer default 10, -- metres per spool
  price_gbp numeric(10,2) not null,
  stock_qty integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── CUSTOMERS ─────────────────────────────
create table customers (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  first_name text,
  last_name text,
  phone text,
  is_guest boolean default false,
  created_at timestamptz default now()
);

-- ── ORDERS ────────────────────────────────
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique not null, -- OSR-2026-0001
  customer_id uuid references customers(id),
  customer_email text not null,
  status text default 'pending', -- pending, paid, processing, shipped, delivered, cancelled, refunded
  
  -- Pricing
  subtotal_gbp numeric(10,2) not null,
  vat_amount_gbp numeric(10,2) default 0,
  shipping_gbp numeric(10,2) default 0,
  total_gbp numeric(10,2) not null,
  vat_rate numeric(5,2) default 20.00,
  
  -- Shipping address
  shipping_name text not null,
  shipping_line1 text not null,
  shipping_line2 text,
  shipping_city text not null,
  shipping_postcode text not null,
  shipping_country text default 'GB',
  
  -- Payment
  payment_method text, -- stripe, paypal
  payment_intent_id text,
  paid_at timestamptz,
  
  -- Fulfilment
  shipped_from text, -- cn, uk
  tracking_number text,
  tracking_carrier text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── ORDER ITEMS ───────────────────────────
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  sku_id uuid references product_skus(id),
  product_name text not null,
  sku_description text not null, -- e.g. "7mm · Warm Sand · 10m"
  quantity integer not null,
  unit_price_gbp numeric(10,2) not null,
  line_total_gbp numeric(10,2) not null,
  created_at timestamptz default now()
);

-- ── TRACKING ──────────────────────────────
create table tracking_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  tracking_number text not null,
  carrier text,
  status text not null,
  message text,
  location text,
  event_time timestamptz,
  created_at timestamptz default now()
);

-- ── NEWSLETTER ────────────────────────────
create table newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  subscribed_at timestamptz default now()
);

-- ── INDEXES ───────────────────────────────
create index on products(collection);
create index on products(slug);
create index on product_skus(product_id);
create index on orders(customer_email);
create index on orders(order_number);
create index on orders(status);
create index on order_items(order_id);

-- ── AUTO-UPDATE updated_at ────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger products_updated_at before update on products
  for each row execute function update_updated_at();
create trigger orders_updated_at before update on orders
  for each row execute function update_updated_at();

-- ── ORDER NUMBER GENERATOR ────────────────
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

-- Public can read active products
create policy "Public read products" on products for select using (is_active = true);
create policy "Public read skus" on product_skus for select using (is_active = true);

-- ── orders / order_items 访问控制 ─────────────────────────────────────────
-- 之前的 "using (true)" 策略会让任何持有公开 anon key 的人读出全表订单
-- （客户姓名/地址/电话/邮箱），必须收紧。
--
-- 业务上所有正常读写路径都不依赖这里的策略：
--   · 结账下单 / Webhook / 客服操作都用 supabaseAdmin（service role，天然绕过 RLS）
--   · 客户端"我的订单"/物流查询都是服务端 API 校验完 auth token 后用 service role 查询
-- 这里的策略只用来兜底：把 orders/order_items 的匿名公开可读堵死，只放行后台管理员。
-- 如需增加管理员邮箱，请同步更新这里和 .env 中的 ADMIN_EMAILS。
-- ⚠️ 建新站的数据库时，把下面这行的邮箱换成该站自己的管理员邮箱
--    （多个邮箱写成 array['a@x.com','b@x.com']），并保持与该站
--    .env 里的 ADMIN_EMAILS 一致，否则后台鉴权和 RLS 会对不上。
create or replace function is_admin_user()
returns boolean as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (
    array['song@onesilkribbon.com']  -- ← REPLACE_ME: 本站管理员邮箱
  )
$$ language sql stable;

drop policy if exists "Own orders" on orders;
drop policy if exists "Own order items" on order_items;

create policy "Admin manage orders" on orders
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage order items" on order_items
  for all using (is_admin_user()) with check (is_admin_user());

create table if not exists paypal_sessions (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  paypal_order_id text not null,
  items           text not null,
  form            text not null,
  totals          text not null,
  user_id         uuid,
  expires_at      timestamptz not null,
  created_at      timestamptz default now()
);

-- paypal_sessions 之前完全没开 RLS——存的是完整客户表单（姓名/地址/电话/邮箱）+ 商品明细，
-- 任何人凭公开 anon key 都能直接读写整张表。这里补上，读写都只走 supabaseAdmin（service role），
-- 不需要放行任何匿名/管理员策略。
alter table paypal_sessions enable row level security;

-- ── 其余几张表：settings / coupons / user_profiles / journal_posts / site_images /
--    subscribers / tracking_events ────────────────────────────────────────
-- 这几张表不在本文件的 create table 语句里（是后台手动建的，schema.sql 没跟上），
-- 但都已经在线上库存在。审计过全部代码后确认：这些表的所有正常读写路径
-- （下单流程、后台管理、session 校验、订阅确认）现在都已经改成走 supabaseAdmin
-- （service role，天然绕过 RLS），不存在任何合法的匿名读写场景，所以直接锁到只放行后台管理员。
alter table settings         enable row level security;
alter table coupons          enable row level security;
alter table user_profiles    enable row level security;
alter table journal_posts    enable row level security;
alter table site_images      enable row level security;
alter table subscribers      enable row level security;
alter table tracking_events  enable row level security;

drop policy if exists "Admin manage settings"        on settings;
drop policy if exists "Admin manage coupons"          on coupons;
drop policy if exists "Admin manage user_profiles"    on user_profiles;
drop policy if exists "Admin manage journal_posts"    on journal_posts;
drop policy if exists "Admin manage site_images"      on site_images;
drop policy if exists "Admin manage subscribers"      on subscribers;
drop policy if exists "Admin manage tracking_events"  on tracking_events;

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

-- ⚠️ 上面那些 drop policy 是**按名字**删的，只能删掉本文件自己建的那几条。
-- 2026-09-30 实测发现：线上库里还残留着建表时在 Supabase 后台点出来的放行策略
-- （名字不是 "Admin manage ..."，所以一直没被删掉）。而 Postgres 的多条 permissive
-- 策略是 OR 关系——只要有一条放行的还在，后面补的管理员策略就形同虚设。
-- 当时 coupons 和 subscribers 就是这个状态：拿公开的 anon key 可以读出全部优惠券、
-- 把 uses_count 改回 0 绕过一次性限制，甚至直接建一张 100% 折扣的新券（服务端下单时
-- 按 code 查库，会把这张自建的券当真）。
--
-- 修复脚本见 migrations/2026-09-30-security-and-atomicity.sql，那里改成枚举 pg_policies
-- 把表上的策略全部删掉再重建，不依赖策略名。
--
-- 这里再加一层表级权限回收：即使以后又有人手滑加了放行策略，没有 GRANT 也读不到。
-- 已确认代码里这些表的所有读写都走 supabaseAdmin（service role 不受 GRANT 限制）。
revoke all on settings         from anon, authenticated;
revoke all on coupons          from anon, authenticated;
revoke all on user_profiles    from anon, authenticated;
revoke all on site_images      from anon, authenticated;
revoke all on subscribers      from anon, authenticated;
revoke all on tracking_events  from anon, authenticated;
revoke all on paypal_sessions  from anon, authenticated;

-- user_addresses（结账地址回存到账户用的表）：线上早就建好并开了 RLS，
-- 但一直没写进本文件，照 schema.sql 重建库时会漏掉这张存客户住址的表。
alter table user_addresses enable row level security;
revoke all on user_addresses from anon;

-- ── 统一媒体库 ────────────────────────────────────────────────────────────
-- 之前商品图/文章封面图/首页图三套上传各玩各的（文章封面图甚至借用商品上传接口、
-- 编个假 productId 糊弄过去）。现在统一成一个媒体库：图片先传进来登记一条记录，
-- 哪里要用图就从库里选，同一张图可以被多处复用，不用重复上传。
create table if not exists media (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  path        text not null,           -- storage 里的实际路径，删除时要用
  filename    text,
  alt_text    text,
  size_bytes  integer,
  namespace   text,                    -- 'product' | 'journal' | 'site' | 'general'，只是给筛选用，不是外键
  created_at  timestamptz default now()
);

alter table media enable row level security;
drop policy if exists "Admin manage media" on media;
create policy "Admin manage media" on media
  for all using (is_admin_user()) with check (is_admin_user());

create index if not exists media_created_at_idx on media(created_at desc);
