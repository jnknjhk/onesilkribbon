-- Non-destructive: preserves every historical order, item, subscriber and payment.
begin;
-- These tables are accessed only through authenticated server APIs/service role.
-- Remove all historical policies, not just policies with known names.
do $$ declare t text; p record; begin
  foreach t in array array['orders','order_items','newsletter_subscribers'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
        execute format('drop policy %I on public.%I',p.policyname,t);
      end loop;
      execute format('revoke all on public.%I from public,anon,authenticated',t);
      execute format('grant all on public.%I to service_role',t);
    end if;
  end loop;
end $$;

-- Persist the provider deadline before the first network request. An ambiguous
-- response must retain its reservation until Stripe is authoritatively checked.
create table if not exists public.stripe_checkout_attempts (
  order_number text primary key references public.orders(order_number) on delete restrict,
  expires_at timestamptz not null,
  session_id text,
  provider_scope text,
  provider_started_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.stripe_checkout_attempts add column if not exists provider_scope text;
alter table public.stripe_checkout_attempts add column if not exists provider_started_at timestamptz;
create index if not exists stripe_attempts_expiry on public.stripe_checkout_attempts(expires_at);
alter table public.stripe_checkout_attempts enable row level security;
revoke all on public.stripe_checkout_attempts from public,anon,authenticated;
grant all on public.stripe_checkout_attempts to service_role;

-- Reservation and provider attempt commit atomically, including the key/account
-- scope. A crash can no longer leave a new reservation without recovery metadata.
create or replace function public.prepare_stripe_checkout(p_order jsonb,p_items jsonb,p_expires_at timestamptz,p_scope text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order jsonb; v_attempt stripe_checkout_attempts%rowtype;
begin
  if p_order->>'payment_method' is distinct from 'stripe' or p_scope is null or p_scope !~ '^[a-f0-9]{64}$'
    or p_expires_at is null or p_expires_at<now()+interval '30 minutes' or p_expires_at>now()+interval '24 hours' then
    raise exception 'Invalid Stripe checkout preparation';
  end if;
  v_order:=prepare_payment_checkout(p_order,p_items);
  insert into stripe_checkout_attempts(order_number,expires_at,provider_scope)
    values(v_order->>'order_number',p_expires_at,p_scope) on conflict do nothing;
  select * into strict v_attempt from stripe_checkout_attempts where order_number=v_order->>'order_number';
  if v_attempt.provider_scope is distinct from p_scope or v_attempt.expires_at is distinct from p_expires_at then
    raise exception 'Stripe attempt identity conflict';
  end if;
  return v_order;
end $$;

create or replace function public.begin_stripe_creation(p_order_number text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype; v_attempt stripe_checkout_attempts%rowtype;
begin
  select * into strict v_order from orders where order_number=p_order_number for update;
  select * into strict v_attempt from stripe_checkout_attempts where order_number=p_order_number for update;
  if v_order.status<>'pending' or v_order.payment_method<>'stripe' or v_attempt.provider_scope is null
    or v_attempt.expires_at<now()+interval '30 minutes'
    or not exists(select 1 from checkout_reservations where order_number=p_order_number and state='active') then
    raise exception 'Stripe checkout is no longer creatable';
  end if;
  update stripe_checkout_attempts set provider_started_at=coalesce(provider_started_at,now()) where order_number=p_order_number;
end $$;

create or replace function public.release_unstarted_stripe_checkout(p_order_number text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_attempt stripe_checkout_attempts%rowtype;
begin
  perform 1 from orders where order_number=p_order_number for update;
  select * into strict v_attempt from stripe_checkout_attempts where order_number=p_order_number for update;
  if v_attempt.provider_scope is null or v_attempt.provider_started_at is not null then
    raise exception 'Provider creation may have started; verify Stripe first';
  end if;
  return release_checkout_reservation(p_order_number,'Stripe 请求尚未发起，安全归还预留');
end $$;

create or replace function public.release_abandoned_stripe_preparations()
returns int language plpgsql security definer set search_path=public as $$
declare v_row record; v_count int:=0;
begin
  for v_row in select a.order_number from stripe_checkout_attempts a join orders o using(order_number)
    where o.status='pending' and a.provider_scope is not null and a.provider_started_at is null
      and a.created_at<now()-interval '2 minutes' order by a.created_at limit 20 loop
    begin
      perform release_unstarted_stripe_checkout(v_row.order_number);
      v_count:=v_count+1;
    exception when raise_exception then null; end;
  end loop;
  return v_count;
end $$;
revoke all on function public.prepare_stripe_checkout(jsonb,jsonb,timestamptz,text),public.begin_stripe_creation(text),
  public.release_unstarted_stripe_checkout(text),public.release_abandoned_stripe_preparations() from public,anon,authenticated;
grant execute on function public.prepare_stripe_checkout(jsonb,jsonb,timestamptz,text),public.begin_stripe_creation(text),
  public.release_unstarted_stripe_checkout(text),public.release_abandoned_stripe_preparations() to service_role;
notify pgrst,'reload schema';
commit;

-- Read-only verification; all three public_read/public_write values should be false.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
  has_table_privilege('anon',c.oid,'select') as anon_read,
  has_table_privilege('authenticated',c.oid,'select') as user_read,
  has_table_privilege('anon',c.oid,'insert,update,delete') as anon_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('orders','order_items','newsletter_subscribers','stripe_checkout_attempts');
