-- 后台管理优化：只新增只读聚合函数和一个客户删除事务函数。
-- 不删除、不改写任何历史订单、支付证据或客户数据；函数未应用时后台会回退到旧逻辑。
begin;

-- ── 1. 订单状态计数 ──────────────────────────────────────────────────────────
-- 一次返回每个状态的订单数，后台按 ORDER_TABS 自行求和，避免每个页签各发一次 count。
create or replace function public.admin_order_status_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
    from (
      select coalesce(status, 'unknown') as status, count(*)::int as cnt
        from orders group by coalesce(status, 'unknown')
    ) s;
$$;

revoke all on function public.admin_order_status_counts() from public, anon, authenticated;
grant execute on function public.admin_order_status_counts() to service_role;

-- ── 2. 库存列表（服务端搜索/筛选/分页）──────────────────────────────────────
-- 搜索同时匹配 SKU 颜色、SKU 编码和所属商品名，不再先取前 100 个商品再过滤，
-- 避免商品多起来之后搜索结果被静默截断。返回结构与旧查询保持一致。
create or replace function public.admin_stock_page(
  p_query text default '',
  p_filter text default '',
  p_threshold int default 3,
  p_limit int default 30,
  p_offset int default 0
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with params as (
  select
    coalesce(btrim(p_query), '') as q,
    coalesce(p_filter, '') as filter,
    greatest(coalesce(p_threshold, 3), 0) as threshold,
    least(greatest(coalesce(p_limit, 30), 1), 100) as lim,
    greatest(coalesce(p_offset, 0), 0) as off
),
matched as (
  select p.id
    from products p, params
   where params.q <> ''
     and (position(lower(params.q) in lower(p.name)) > 0
       or position(lower(params.q) in lower(p.slug)) > 0)
),
filtered as (
  select s.*, p.name as product_name, p.is_active as product_active
    from product_skus s
    join products p on p.id = s.product_id
   cross join params
   where (params.filter not in ('low', 'out')
          or (s.is_active is not false and p.is_active is not false))
     and (params.filter <> 'out' or coalesce(s.stock_qty, 0) <= 0)
     and (params.filter <> 'low' or coalesce(s.stock_qty, 0) <= params.threshold)
     and (params.q = ''
          or position(lower(params.q) in lower(s.colour)) > 0
          or position(lower(params.q) in lower(s.sku_code)) > 0
          or p.id in (select id from matched))
),
counted as (select count(*)::int as total from filtered),
page as (
  select * from filtered
   order by sku_code, id
   limit (select lim from params) offset (select off from params)
)
select jsonb_build_object(
  'skus', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', page.id,
      'product_id', page.product_id,
      'colour', page.colour,
      'colour_hex', page.colour_hex,
      'attributes', page.attributes,
      'stock_qty', page.stock_qty,
      'price_gbp', page.price_gbp,
      'is_active', page.is_active,
      'sku_code', page.sku_code,
      'products', jsonb_build_object('name', page.product_name, 'is_active', page.product_active)
    ) order by page.sku_code, page.id)
    from page
  ), '[]'::jsonb),
  'total', (select total from counted)
);
$$;

revoke all on function public.admin_stock_page(text, text, int, int, int) from public, anon, authenticated;
grant execute on function public.admin_stock_page(text, text, int, int, int) to service_role;

-- ── 3. 媒体文件被哪些内容使用 ────────────────────────────────────────────────
-- 在数据库里做包含查询，避免把商品、SKU、文章整表拉到 Node 再逐行 JSON.stringify。
-- 返回可直接展示的中文标签数组。
create or replace function public.admin_media_usage(p_url text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text := btrim(coalesce(p_url, ''));
  v_labels text[] := '{}';
  v_label text;
begin
  if v_url = '' then
    return '[]'::jsonb;
  end if;

  for v_label in
    select distinct x.label
      from (
        select '商品「' || p.name || '」' as label
          from products p
         where v_url = any(coalesce(p.images, '{}'::text[]))
            or position(v_url in coalesce(p.attribute_config::text, '')) > 0
            or position(v_url in coalesce(p.specifications::text, '')) > 0
        union
        select '商品 SKU'
          from product_skus s
         where v_url = any(coalesce(s.images, '{}'::text[]))
        union
        select '网站图片 ' || si.key
          from site_images si
         where si.url = v_url
        union
        select '文章「' || jp.title || '」'
          from journal_posts jp
         where jp.cover_image = v_url
            or position(v_url in coalesce(jp.sections::text, '')) > 0
      ) x
     order by x.label
  loop
    v_labels := array_append(v_labels, v_label);
  end loop;

  return to_jsonb(v_labels);
end $$;

revoke all on function public.admin_media_usage(text) from public, anon, authenticated;
grant execute on function public.admin_media_usage(text) to service_role;

-- ── 4. 客户删除（数据库部分一个事务）────────────────────────────────────────
-- 登录账号由后台在调用前删除（GoTrue 的 auth 用户无法放进数据库事务）。
-- 这里把关闭未付款订单、支付证据脱敏、删资料/地址/订阅、订单匿名化、
-- 清 customers/coupons/email_log 放在同一个事务里：任何一步失败都整体回滚。
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
  v_email text := btrim(coalesce(p_email, ''));
  v_numbers text[] := coalesce(p_order_numbers, '{}'::text[]);
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

  -- 1. 关闭还没付款的订单；有支付证据时 close_unpaid_order 会抛错，整个删除回滚。
  for v_number in
    select order_number
      from orders
     where lower(customer_email) = lower(v_email)
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
  if array_length(p_user_ids, 1) is not null then
    delete from user_addresses where user_id = any(p_user_ids);
    delete from user_profiles where id = any(p_user_ids);
    v_accounts := array_length(p_user_ids, 1);
  end if;

  -- 4. 邮件订阅（订阅时邮箱统一存小写，这里两种大小写都清）。
  delete from subscribers where lower(email) = lower(v_email);
  get diagnostics v_subscribers = row_count;
  delete from newsletter_subscribers where lower(email) = lower(v_email);

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
   where lower(customer_email) = lower(v_email)
      or order_number = any(v_numbers);
  get diagnostics v_anonymized = row_count;

  -- 6. 旧的 customers 表。
  delete from customers where lower(email) = lower(v_email);
  get diagnostics v_customers = row_count;

  -- 7. 欢迎券说明里可能带邮箱。
  update coupons
     set description = 'Welcome discount（客户已删除）'
   where description in ('Welcome discount for ' || v_email,
                         'Welcome discount for ' || lower(v_email));

  -- 8. 邮件记录里的收件人（联系表单没有 order_number，按邮箱清）。
  update email_log
     set to_email = 'deleted-customer@invalid',
         subject = null,
         error = null
   where lower(to_email) = lower(v_email);

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
