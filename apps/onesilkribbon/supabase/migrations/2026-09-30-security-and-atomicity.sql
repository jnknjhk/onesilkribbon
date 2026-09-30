-- ════════════════════════════════════════════════════════════════════════════
-- 2026-09-30  安全加固 + 并发安全
--
-- 第 1 节是紧急的：coupons 和 subscribers 两张表对公开的 anon key 完全开放，
-- 任何人都能自建 100% 折扣码并被服务端认可。请优先执行。
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. 堵住 coupons / subscribers 的匿名读写 ─────────────────────────────────
--
-- schema.sql 里明明写了 "Admin manage coupons" 这条只允许管理员的策略，线上库却依然
-- 能用 anon key 读写。原因是 Postgres 的**多条 permissive 策略是 OR 关系**：线上还
-- 残留着一条早期的放行策略（大概是建表时顺手点的 "Enable read/write for everyone"），
-- 只要它还在，后来补的管理员策略就形同虚设。
--
-- 实测（2026-09-30，对着正式库）用公开 anon key 可以：
--   · 读出全部 7 张优惠券，包括 TEST98（98% off）和几张一次性的 WELCOME 码
--   · 把 uses_count 改回 0，绕过 max_uses 限制反复使用同一张一次性券
--   · 直接 INSERT 一张 100% 折扣、不限次数的新券——而下单时服务端是按 code 去库里
--     查真实折扣的（lib/order-pricing.js），所以这张自建的券会被正常认可，等于免费拿货
--   · 读出并修改全部订阅者邮箱
--
-- anon key 是打包进浏览器 JS 里的公开凭据，人人可见，所以这不是"需要先拿到密钥"的问题。
--
-- 策略名未知（是在后台点出来的），所以按表把策略全部枚举删除，再重建唯一一条管理员策略。
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('coupons', 'subscribers')
  loop
    raise notice '删除策略 %.%', p.tablename, p.policyname;
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.coupons     enable row level security;
alter table public.subscribers enable row level security;

create policy "Admin manage coupons" on public.coupons
  for all using (is_admin_user()) with check (is_admin_user());
create policy "Admin manage subscribers" on public.subscribers
  for all using (is_admin_user()) with check (is_admin_user());

-- RLS 之外再撤掉表级权限，双保险。
-- 已确认代码里所有优惠券/订阅路径都走 service role：/api/coupon、lib/order-pricing.js、
-- 两条支付回调、/api/verify-email、后台 /api/admin/coupons 与 /api/admin/subscribers，
-- 没有任何地方用 anon key 直接查这两张表，所以撤权不会影响前台功能。
revoke all on public.coupons     from anon, authenticated;
revoke all on public.subscribers from anon, authenticated;


-- ── 2. 库存扣减与优惠券计数改为原子操作 ──────────────────────────────────────
--
-- 原来是"先 select 当前值，在 Node 里减一，再 update 回去"（lib/stock-check.js）。
-- 两笔订单同时结算、或 Stripe 把同一个 webhook 推两次时，两边可能读到同样的旧值，
-- 后写的那次把前一次的扣减覆盖掉——库存少扣，就会超卖。
-- 丝带备货多，概率低；但玻璃站以孤品为主，超卖一件就得跟客人解释，所以按正确写法改。
--
-- 单条 UPDATE 语句在 Postgres 里对同一行是串行的，天然不会丢更新。
--
-- 先把同名的旧函数全部删掉再重建。原因：库里已经存在一个
-- increment_coupon_uses(coupon_code text)（返回 void，来历不明的遗留物），
-- 而 create or replace 不允许改返回类型，会直接报 42P13 让整个脚本回滚。
-- 参数名也不一样（coupon_code vs p_code），PostgREST 是按参数名解析的，
-- 所以代码里那次调用其实一直找不到它——等于这个函数从来没被用上过。
-- 这里按函数名枚举删除，不写死签名，免得以后又撞上别的重载。
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('decrement_sku_stock', 'increment_coupon_uses')
  loop
    raise notice '删除旧函数 %', f.sig;
    execute format('drop function %s', f.sig);
  end loop;
end $$;

create function public.decrement_sku_stock(p_sku_id uuid, p_qty int)
returns int
language sql
security definer
set search_path = public
as $$
  update product_skus
     set stock_qty = greatest(0, coalesce(stock_qty, 0) - greatest(0, p_qty))
   where id = p_sku_id
  returning stock_qty;
$$;

create function public.increment_coupon_uses(p_code text)
returns int
language sql
security definer
set search_path = public
as $$
  update coupons
     set uses_count = coalesce(uses_count, 0) + 1
   where code = upper(trim(p_code))
  returning uses_count;
$$;

-- security definer 的函数默认是 public 可执行的，必须收回——否则等于开了一个
-- 谁都能调用的"把任意 SKU 库存减掉"和"把优惠券用完"的接口。
revoke all on function public.decrement_sku_stock(uuid, int) from anon, authenticated, public;
revoke all on function public.increment_coupon_uses(text)    from anon, authenticated, public;


-- ── 3. 注册时自动建客户档案 ──────────────────────────────────────────────────
--
-- 之前补的 ensureUserProfile() 挂在 /api/auth/session 上，而那条路由其实从来没有被
-- 调用过（它读的是 sb-access-token，现在的登录写的是 @supabase/ssr 的 cookie），
-- 所以"每次登录都会兜底建档"这个说法是不成立的。实际只有访问 /api/user/profile 时才会建。
--
-- 正确的做法是放在数据库触发器里：邮箱注册、Google 登录、以后加的任何登录方式，
-- 都一定会往 auth.users 插一行，这里是唯一绕不过去的必经之路。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full  text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_first text;
  v_last  text;
begin
  v_first := nullif(split_part(trim(v_full), ' ', 1), '');
  -- 只有真的含空格才拆姓氏，否则 substring 会把整个名字又当成姓氏重复一遍
  if position(' ' in trim(v_full)) > 0 then
    v_last := nullif(trim(substring(trim(v_full) from position(' ' in trim(v_full)) + 1)), '');
  end if;

  insert into public.user_profiles (id, email, first_name, last_name, avatar_url)
  values (new.id, new.email, v_first, v_last, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  return new;
exception when others then
  -- 建档失败绝不能让注册本身失败——档案可以事后补，注册被挡住客户就直接流失了
  raise warning '[handle_new_user] 建档失败 %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 4. 补记 user_addresses 的 RLS（线上已开启，schema.sql 一直漏记） ──────────
--
-- 实测线上库已经开了 RLS 且匿名读不到内容，这里只是把它写进版本库，
-- 免得以后照 schema.sql 重建库时把这张存客户住址的表漏掉。
alter table public.user_addresses enable row level security;
revoke all on public.user_addresses from anon;

notify pgrst, 'reload schema';
