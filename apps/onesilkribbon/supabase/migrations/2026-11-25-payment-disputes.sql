-- 支付争议（拒付 / chargeback / PayPal dispute）。
-- 只新增表，不改订单状态：订单的 paid/shipped 仍由支付与履约决定，
-- 争议单独记录，后台在“支付恢复”和订单详情里提示店主处理。
begin;

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'paypal')),
  dispute_id text not null,
  order_number text references public.orders(order_number) on delete set null,
  payment_id text,
  status text not null,
  reason text,
  amount_pence integer check (amount_pence is null or amount_pence > 0),
  currency text,
  evidence_due_by timestamptz,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (provider, dispute_id)
);

create index if not exists payment_disputes_order_idx
  on public.payment_disputes(order_number);
create index if not exists payment_disputes_open_idx
  on public.payment_disputes(updated_at desc)
  where resolved_at is null;

alter table public.payment_disputes enable row level security;
revoke all on public.payment_disputes from public, anon, authenticated;
grant all on public.payment_disputes to service_role;

notify pgrst, 'reload schema';
commit;
