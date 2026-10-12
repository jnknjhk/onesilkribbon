-- ════════════════════════════════════════════════════════════════════════════
-- 2026-10-12  安全加固 + 并发安全（从 onesilkribbon 2026-09-30 的同名迁移移植）
--
-- 在 Supabase 后台 → SQL Editor → New query，把这份内容整段粘贴执行。
-- 不改动任何已有数据，可安全重复执行。schema.sql 末尾也有同样的内容，
-- 新建的库跑 schema.sql 就够了；已经建好的库跑这一份。
--
-- ⚠️ 代码（lib/stock-check.js）已经改成调用下面两个数据库函数，函数不存在时会退回
--    旧的非原子写法并在日志里报错提醒。请尽快执行。
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. coupons / subscribers 只允许管理员访问，并撤掉表级权限 ─────────────────
--
-- 丝带站线上库曾经因为一条在 Supabase 后台点出来的放行策略（名字不是
-- "Admin manage ..."，按名字删不掉），让公开的 anon key 可以读写 coupons：
-- 自建一张 100% 折扣券，下单时服务端按 code 查库就会认可它。
-- Postgres 的多条 permissive 策略是 OR 关系，所以这里不按名字删，而是把
-- 这两张表上的策略全部枚举删除，再重建唯一一条管理员策略。
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

-- RLS 之外再撤掉表级权限，双保险：以后就算又有人加了放行策略，没有 GRANT 也读不到。
-- 已确认代码里这几张表的所有读写都走 supabaseAdmin（service role 不受 GRANT 限制）。
revoke all on public.coupons         from anon, authenticated;
revoke all on public.subscribers     from anon, authenticated;
revoke all on public.paypal_sessions from anon, authenticated;
revoke all on public.tracking_events from anon, authenticated;


-- ── 2. 库存扣减与优惠券计数改为原子操作 ──────────────────────────────────────
--
-- 原来是"先 select 当前值，在 Node 里减一，再 update 回去"。两笔订单同时结算、
-- 或 Stripe 把同一个 webhook 推两次时，两边可能读到同样的旧值，后写的那次把
-- 前一次的扣减覆盖掉——库存少扣，就会超卖。玻璃站以孤品为主，超卖一件就得跟客人解释。
-- 单条 UPDATE 语句在 Postgres 里对同一行是串行的，天然不会丢更新。
--
-- 先按函数名把同名旧函数全部删掉再重建：create or replace 不允许改返回类型，
-- 遇到签名不同的遗留重载会直接报错让整个脚本回滚。
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

notify pgrst, 'reload schema';
