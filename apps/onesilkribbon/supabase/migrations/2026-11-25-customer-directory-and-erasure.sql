-- 客户目录与 GDPR 删除的两个覆盖洞：
--   1. 只有订单的客户才会出现在 customer_summary 里；零订单账号与“只订阅未下单”
--      的人在后台找不到，也无法删除。
--   2. 删除按 customer_email 精确匹配；账户 user_id 关联、但结账邮箱不同的订单
--      不会被匿名化。
-- 本迁移只新增视图、升级删除函数；不删除任何订单或支付证据。
begin;

-- 客户目录 = 订单客户 + 有账号的人 + 订阅者，邮箱统一小写并合并同一人。
create or replace view public.customer_directory as
with order_rollup as (
  select
    lower(email)                                                                as email,
    (array_agg(name    order by last_order desc nulls last))[1]                 as name,
    (array_agg(city    order by last_order desc nulls last))[1]                 as city,
    (array_agg(country order by last_order desc nulls last))[1]                 as country,
    sum(orders)::int                                                            as orders,
    sum(spent)::numeric                                                         as spent,
    max(last_order)                                                             as last_order,
    (array_agg(user_id) filter (where user_id is not null))[1]                  as user_id,
    sum(paid_orders)::int                                                       as paid_orders
  from public.customer_summary
  where email is not null and email <> 'unknown'
  group by lower(email)
),
profile_rollup as (
  select
    lower(btrim(email))                                                         as email,
    (array_agg(id order by created_at desc nulls last))[1]                      as user_id,
    (array_agg(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
       order by created_at desc nulls last))[1]                                 as name
  from public.user_profiles
  where email is not null and btrim(email) <> ''
  group by lower(btrim(email))
),
subscriber_rollup as (
  select email, bool_or(subscribed) as subscribed from (
    select lower(btrim(email)) as email,
           (status is distinct from 'unsubscribed') as subscribed
      from public.subscribers
     where email is not null and btrim(email) <> ''
    union all
    select lower(btrim(email)) as email, true
      from public.newsletter_subscribers
     where email is not null and btrim(email) <> ''
  ) rows
  group by email
),
emails as (
  select email from order_rollup
  union select email from profile_rollup
  union select email from subscriber_rollup
)
select
  e.email,
  coalesce(o.name, p.name)                                                      as name,
  o.city,
  o.country,
  coalesce(o.orders, 0)::int                                                    as orders,
  coalesce(o.spent, 0)::numeric                                                 as spent,
  o.last_order,
  coalesce(o.user_id, p.user_id)                                                as user_id,
  coalesce(o.paid_orders, 0)::int                                               as paid_orders,
  (p.user_id is not null)                                                       as has_account,
  coalesce(s.subscribed, false)                                                 as subscribed
from emails e
left join order_rollup o on o.email = e.email
left join profile_rollup p on p.email = e.email
left join subscriber_rollup s on s.email = e.email;

revoke all on public.customer_directory from public, anon, authenticated;
grant select on public.customer_directory to service_role;

-- 删除客户：把所有属于该客户的订单先算出来（按邮箱、显式单号、直接匹配的账号
-- user_id 三种方式），再关闭/脱敏/匿名化。订阅限流历史里的邮箱也一并清掉。
create or replace function public.admin_erase_customer_data(
  p_email text,
  p_user_ids uuid[] default '{}',
  p_order_numbers text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user_ids uuid[] := coalesce(p_user_ids, '{}'::uuid[]);
  v_numbers text[];
  v_number text;
  v_closed int := 0;
  v_anonymized int := 0;
  v_accounts int := 0;
  v_subscribers int := 0;
  v_customers int := 0;
begin
  if v_email = '' then
    raise exception 'email_required';
  end if;

  select coalesce(array_agg(distinct order_number), '{}'::text[])
    into v_numbers
    from orders
   where lower(btrim(customer_email)) = v_email
      or order_number = any(coalesce(p_order_numbers, '{}'::text[]))
      or (array_length(v_user_ids, 1) is not null and user_id = any(v_user_ids));

  -- 1. 关闭还没付款的订单；有支付证据时 close_unpaid_order 会抛错，整个删除回滚。
  for v_number in
    select order_number
      from orders
     where order_number = any(v_numbers)
       and status = 'pending'
       and paid_at is null
     order by order_number
  loop
    perform close_unpaid_order(v_number, '客户删除：关闭未付款订单');
    v_closed := v_closed + 1;
  end loop;

  -- 2. 支付证据只脱敏，不删除金额、支付单号和时间。
  perform anonymize_customer_payment_evidence(v_numbers);

  -- 3. 账号资料和常用地址。user_ids 由后台在删除 auth 账号前算好并传入。
  if array_length(v_user_ids, 1) is not null then
    delete from user_addresses where user_id = any(v_user_ids);
    delete from user_profiles where id = any(v_user_ids);
    v_accounts := array_length(v_user_ids, 1);
  end if;

  -- 4. 邮件订阅与订阅限流历史（都存过这个邮箱）。
  delete from subscribers where lower(email) = v_email;
  get diagnostics v_subscribers = row_count;
  delete from newsletter_subscribers where lower(email) = v_email;
  delete from subscription_email_requests where lower(email) = v_email;
  delete from subscription_email_attempts where lower(email) = v_email;

  -- 5. 订单保留，只换掉个人信息。付款订单是财务记录，未付款订单已关闭供对账。
  update orders
     set customer_email = 'deleted-customer@invalid',
         shipping_name = '已删除的客户',
         shipping_line1 = '—',
         shipping_line2 = null,
         shipping_city = '—',
         shipping_postcode = '—',
         phone = null,
         user_id = null,
         customer_id = null,
         notes = null
   where order_number = any(v_numbers);
  get diagnostics v_anonymized = row_count;

  -- 6. 旧的 customers 表。先解除其它订单对它的引用，再删除。
  update orders
     set customer_id = null
   where customer_id in (select id from customers where lower(email) = v_email);
  delete from customers where lower(email) = v_email;
  get diagnostics v_customers = row_count;

  -- 7. 欢迎券说明里可能带邮箱。
  update coupons
     set description = 'Welcome discount（客户已删除）'
   where lower(description) in ('welcome discount for ' || v_email);

  -- 8. 邮件记录里的收件人（联系表单没有 order_number，按邮箱清）。
  update email_log
     set to_email = 'deleted-customer@invalid',
         subject = null,
         error = null
   where lower(to_email) = v_email;

  return jsonb_build_object(
    'accounts', v_accounts,
    'closedOrders', v_closed,
    'anonymizedOrders', v_anonymized,
    'subscribers', v_subscribers,
    'customers', v_customers
  );
end $$;

revoke all on function public.admin_erase_customer_data(text, uuid[], text[]) from public, anon, authenticated;
grant execute on function public.admin_erase_customer_data(text, uuid[], text[]) to service_role;

notify pgrst, 'reload schema';
commit;
