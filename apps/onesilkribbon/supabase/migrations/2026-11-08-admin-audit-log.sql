-- 后台敏感操作审计。只新增表，不修改任何业务数据。
-- 写入失败不能影响主操作；后台在表不存在时会静默跳过，界面显示“尚未启用”。
begin;

create table if not exists public.admin_audit_log (
  id bigserial primary key,
  actor_email text not null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc, id desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant all on public.admin_audit_log to service_role;
revoke all on sequence public.admin_audit_log_id_seq from public, anon, authenticated;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

notify pgrst, 'reload schema';
commit;
