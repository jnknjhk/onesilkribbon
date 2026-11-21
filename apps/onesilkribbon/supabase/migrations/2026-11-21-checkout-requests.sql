begin;

-- The unique key serializes identical requests across processes before stock is held.
-- The checkout link is available only to the original browser and request payload.
create table if not exists public.checkout_requests (
  request_key text primary key,
  order_number text not null,
  reply jsonb,
  expires_at timestamptz
);

alter table public.checkout_requests enable row level security;
revoke all on public.checkout_requests from public, anon, authenticated;
grant select, insert, update, delete on public.checkout_requests to service_role;

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
  v_full boolean := coalesce(p_full, false);
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

  -- Stripe reports each partial refund separately. The order lock keeps this
  -- sum consistent across overlapping charge and refund events.
  if p_provider = 'stripe' and p_payment_id is not null and upper(btrim(p_currency)) = 'GBP'
      and left(p_refund_id, 3) = 're_' and v_order.payment_method = 'stripe' then
    select coalesce(sum(amount_pence), 0) >= round(v_order.total_gbp * 100)
      into v_full from payment_refunds
      where provider = 'stripe' and order_number = p_order_number and payment_id = p_payment_id
        and currency = 'GBP' and left(refund_id, 3) = 're_';
  end if;

  if v_full and v_order.status in ('paid', 'shipped', 'delivered') then
    insert into refund_requests(
      order_id, manual, restock, reason, provider_id, provider_status, completed_at
    ) values (
      v_order.id, true, false, '支付平台退款（外部）', p_refund_id, 'succeeded', now()
    ) on conflict (order_id) do update set
      provider_id = coalesce(refund_requests.provider_id, excluded.provider_id),
      -- An existing admin request still needs to apply its selected stock handling.
      provider_status = excluded.provider_status;

    update orders
       set status = 'refunded', refund_reason = '支付平台退款（外部）'
     where id = v_order.id
     returning * into v_order;
  end if;

  update payment_refunds
     set processed_at = now(), full_refund = v_full
   where provider = p_provider and refund_id = p_refund_id;

  return jsonb_build_object(
    'ok', true, 'already', false, 'refund_id', p_refund_id,
    'order_status', v_order.status, 'full_refund', v_full
  );
end $$;

notify pgrst, 'reload schema';
commit;
