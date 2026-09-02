-- ═══════════════════════════════════════════════════════════════
-- 2026-09-02 · 邮件发送记录
--
-- 在 Supabase 后台 → SQL Editor → New query，把这份内容整段粘贴执行。
-- 只新增一张表，不改动任何已有数据，可安全重复执行。
-- ═══════════════════════════════════════════════════════════════

create table if not exists email_log (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,          -- order_confirmation | owner_notification | shipping | contact | marketing
  to_email     text not null,
  subject      text,
  order_number text,                   -- 与订单相关的邮件会带上，方便按订单查
  status       text not null,          -- sent | failed
  error        text,                   -- 失败原因（status = failed 时）
  provider_id  text,                   -- Resend 返回的邮件 id，用于去它后台核对
  created_at   timestamptz default now()
);

create index if not exists email_log_created_at_idx   on email_log(created_at desc);
create index if not exists email_log_to_email_idx     on email_log(to_email);
create index if not exists email_log_order_number_idx on email_log(order_number);

-- 和其余业务表一致：只允许后台管理员访问，
-- 实际读写都走 service role（天然绕过 RLS）
alter table email_log enable row level security;
drop policy if exists "Admin manage email_log" on email_log;
create policy "Admin manage email_log" on email_log
  for all using (is_admin_user()) with check (is_admin_user());
