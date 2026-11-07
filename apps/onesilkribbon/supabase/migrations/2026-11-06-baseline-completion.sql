-- Additive only: fills columns that the original schema.sql missed but the
-- application and later migrations already use. Safe on existing databases;
-- never drops or rewrites business data.
begin;

alter table public.orders
  add column if not exists user_id uuid,
  add column if not exists discount_gbp numeric(10,2) default 0,
  add column if not exists phone text,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refund_reason text,
  add column if not exists tracking_url text;

alter table public.products
  add column if not exists sort_order integer default 0,
  add column if not exists attribute_config jsonb default '[]'::jsonb,
  add column if not exists specifications jsonb default '[]'::jsonb;

alter table public.product_skus
  add column if not exists attributes jsonb default '{}'::jsonb,
  add column if not exists images text[] default '{}';

notify pgrst, 'reload schema';
commit;
