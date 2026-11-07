-- Additive read-only dashboard aggregation. No business data is changed.
begin;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_threshold int;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_result jsonb;
begin
  select coalesce(
    (
      select case
        when value ~ '^\s*-?[0-9]+'
          then substring(value from '^\s*-?[0-9]+')::int
      end
      from settings where key = 'low_stock_threshold'
    ),
    3
  ) into v_threshold;
  v_threshold := coalesce(v_threshold, 3);

  select jsonb_build_object(
    'todo', jsonb_build_object(
      'toShip', (
        select count(*)::int from orders where status = 'paid'
      ),
      'toShipOverdue', (
        select count(*)::int from orders
         where status = 'paid'
           and coalesce(paid_at, created_at) < now() - interval '2 days'
      ),
      'lowStock', (
        select count(*)::int
          from product_skus s
          join products p on p.id = s.product_id
         where s.is_active is not false
           and p.is_active is not false
           and coalesce(s.stock_qty, 0) <= v_threshold
      ),
      'lowStockThreshold', v_threshold,
      'needsReview', (
        select count(*)::int
          from orders o
         where o.status in ('paid', 'shipped', 'delivered')
           and not exists (select 1 from order_items i where i.order_id = o.id)
      ),
      'failedEmails', (
        select count(*)::int
          from email_log
         where status = 'failed'
           and created_at >= now() - interval '7 days'
      )
    ),
    'sales', (
      select jsonb_build_object(
        'today', jsonb_build_object(
          'revenue', round(coalesce(sum(total_gbp) filter (where day = v_today), 0), 2),
          'orders', (count(*) filter (where day = v_today))::int
        ),
        'd7', jsonb_build_object(
          'revenue', round(coalesce(sum(total_gbp) filter (where day >= v_today - 6), 0), 2),
          'orders', (count(*) filter (where day >= v_today - 6))::int
        ),
        'd30', jsonb_build_object(
          'revenue', round(coalesce(sum(total_gbp) filter (where day >= v_today - 29), 0), 2),
          'orders', (count(*) filter (where day >= v_today - 29))::int
        ),
        'all', jsonb_build_object(
          'revenue', round(coalesce(sum(total_gbp), 0), 2),
          'orders', count(*)::int
        )
      )
      from (
        select total_gbp, (created_at at time zone 'Europe/London')::date as day
          from orders
         where status in ('paid', 'shipped', 'delivered')
      ) revenue
    ),
    'productsActive', (
      select count(*)::int from products where is_active is not false
    ),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select id, order_number, status, total_gbp, created_at, paid_at, customer_email, shipping_name
          from orders
         order by created_at desc, id desc
         limit 6
      ) recent
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.admin_dashboard() from public, anon, authenticated;
grant execute on function public.admin_dashboard() to service_role;

notify pgrst, 'reload schema';
commit;
