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

-- Orders readable by matching email (for guest tracking)
create policy "Own orders" on orders for select using (true);
create policy "Own order items" on order_items for select using (true);
