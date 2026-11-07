-- Additive only: records provider refunds and, for a full refund, marks the order
-- refunded without touching stock. Stock is deliberately left for manual review so a
-- damaged/lost-item refund cannot silently put inventory back on sale.
begin;

create table if not exists public.payment_refunds (
  provider text not null check (provider in ('stripe', 'paypal')),
  refund_id text not null,
  order_number text not null references public.orders(order_number) on delete restrict,
  payment_id text,
  amount_pence bigint not null check (amount_pence > 0),
  currency text not null,
  full_refund boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, refund_id)
);

create index if not exists payment_refunds_order_idx
  on public.payment_refunds(order_number);

alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;
grant all on public.payment_refunds to service_role;

-- Idempotent: the same provider refund is recorded once. A full refund updates the
-- order/refund-request state; a partial refund is recorded without changing the order.
create or replace function public.record_external_refund(
  p_provider text,
  p_refund_id text,
  p_order_number text,
  p_payment_id text,
  p_amount_pence bigint,
  p_currency text,
  p_full boolean,
  p_evidence jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_inserted int := 0;
begin
  if p_provider not in ('stripe', 'paypal')
     or p_refund_id is null or length(btrim(p_refund_id)) = 0
     or p_order_number is null
     or p_amount_pence is null or p_amount_pence <= 0
     or p_currency is null or length(btrim(p_currency)) <> 3 then
    raise exception 'invalid_refund';
  end if;

  select * into v_order from orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  insert into payment_refunds(
    provider, refund_id, order_number, payment_id, amount_pence, currency, full_refund, evidence
  ) values (
    p_provider, p_refund_id, p_order_number, p_payment_id, p_amount_pence,
    upper(btrim(p_currency)), coalesce(p_full, false), coalesce(p_evidence, '{}'::jsonb)
  ) on conflict (provider, refund_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'already', true, 'refund_id', p_refund_id);
  end if;

  if coalesce(p_full, false) and v_order.status in ('paid', 'shipped', 'delivered') then
    insert into refund_requests(
      order_id, manual, restock, reason, provider_id, provider_status, completed_at
    ) values (
      v_order.id, true, false, '支付平台退款（外部）', p_refund_id, 'succeeded', now()
    ) on conflict (order_id) do update set
      provider_id = coalesce(refund_requests.provider_id, excluded.provider_id),
      provider_status = excluded.provider_status,
      completed_at = coalesce(refund_requests.completed_at, excluded.completed_at);

    update orders
       set status = 'refunded', refund_reason = '支付平台退款（外部）'
     where id = v_order.id
     returning * into v_order;
  end if;

  update payment_refunds
     set processed_at = now()
   where provider = p_provider and refund_id = p_refund_id;

  return jsonb_build_object(
    'ok', true, 'already', false, 'refund_id', p_refund_id,
    'order_status', v_order.status, 'full_refund', coalesce(p_full, false)
  );
end $$;

revoke all on function public.record_external_refund(text,text,text,text,bigint,text,boolean,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_external_refund(text,text,text,text,bigint,text,boolean,jsonb)
  to service_role;

notify pgrst, 'reload schema';
commit;
