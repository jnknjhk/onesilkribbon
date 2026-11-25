begin;

create table if not exists public.product_internal_names (
  product_id uuid primary key references public.products(id) on delete cascade,
  internal_name text not null check (char_length(btrim(internal_name)) between 1 and 100)
);

alter table public.product_internal_names enable row level security;
revoke all on table public.product_internal_names from public, anon, authenticated;
grant select, insert, update, delete on table public.product_internal_names to service_role;

create table if not exists public.product_internal_name_access (
  id boolean primary key default true check (id),
  owner_email_hash text not null check (owner_email_hash ~ '^[0-9a-f]{64}$')
);

alter table public.product_internal_name_access enable row level security;
revoke all on table public.product_internal_name_access from public, anon, authenticated, service_role;
grant select on table public.product_internal_name_access to service_role;

commit;
