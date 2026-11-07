-- Additive only. Links guest orders to a verified account by email and aligns
-- customer-summary spending with the paid-order definition used elsewhere.
-- It never deletes orders or changes amounts/addresses/payment data.
begin;

-- Claim only unowned orders whose email matches the verified account email.
create or replace function public.claim_guest_orders(p_user_id uuid, p_email text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if p_user_id is null then
    raise exception 'invalid_claim';
  end if;
  if p_email is null
     or length(btrim(p_email)) = 0
     or length(btrim(p_email)) > 254
     or btrim(p_email) !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'invalid_claim';
  end if;

  update orders
     set user_id = p_user_id
   where user_id is null
     and lower(btrim(customer_email)) = lower(btrim(p_email));

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.claim_guest_orders(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid, text) to service_role;

-- Speeds up the claim; only unowned orders are indexed.
create index if not exists orders_guest_email_idx
  on public.orders (lower(customer_email))
  where user_id is null;

-- Keep the customer list aligned with dashboard revenue and customer detail:
-- "spent" means paid/shipped/delivered only; total order count remains all orders.
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

revoke all on customer_summary from anon, authenticated;
grant select on customer_summary to service_role;

notify pgrst, 'reload schema';
commit;
