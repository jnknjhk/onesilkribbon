-- Additive only. Closes abandoned checkouts and strips customer PII from payment
-- evidence without deleting orders, items, receipts or reconciliation records.
-- Safe to run repeatedly; it never rewrites historical amounts, payment IDs or dates.
begin;

-- ── 1. Close an unpaid order without deleting it ─────────────────────────────
-- 只允许“待付款”订单；已有 payment_receipts 的订单一律拒绝，交给人工对账。
-- 有库存预占时先走 release_checkout_reservation，保证库存归还不丢。
create or replace function public.close_unpaid_order(
  p_order_number text,
  p_reason text default 'abandoned'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_hold checkout_reservations%rowtype;
begin
  select * into v_order from orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status <> 'pending' then
    return jsonb_build_object('ok', true, 'status', v_order.status, 'changed', false);
  end if;

  -- A paid order must never be silently cancelled by cleanup.
  if exists (select 1 from payment_receipts where order_number = p_order_number) then
    raise exception 'payment_evidence_exists';
  end if;

  select * into v_hold from checkout_reservations where order_number = p_order_number for update;

  if found and v_hold.state in ('active', 'capturing') then
    perform release_checkout_reservation(p_order_number, coalesce(p_reason, 'abandoned'));
    select * into v_order from orders where order_number = p_order_number;
    return jsonb_build_object('ok', true, 'status', v_order.status, 'changed', true);
  end if;

  -- Legacy checkout with no reservation: cancel directly. The trigger only blocks
  -- cancellation while an active/capturing reservation exists, which was handled above.
  update orders
     set status = 'cancelled',
         cancel_reason = coalesce(p_reason, 'abandoned'),
         cancelled_at = now()
   where id = v_order.id and status = 'pending'
   returning * into v_order;

  if not found then
    raise exception 'order_changed';
  end if;

  return jsonb_build_object('ok', true, 'status', v_order.status, 'changed', true);
end $$;

-- ── 2. Strip PII while keeping financial/reconciliation data ──────────────────
-- payment_checkouts.snapshot / payment_notifications.payload: only remove known
-- PII keys from the embedded order object. Items (product names, quantities,
-- prices) and all money/IDs/dates remain.
-- payment_receipts.evidence: replace the raw provider event with a marker; the
-- receipt row itself still keeps provider/payment_id/order_number/amount/currency
-- and processed_at for reconciliation.
create or replace function public.anonymize_customer_payment_evidence(p_order_numbers text[])
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_number text;
  v_count int := 0;
  v_pii text[] := array[
    'customer_email', 'shipping_name', 'shipping_line1', 'shipping_line2',
    'shipping_city', 'shipping_postcode', 'phone', 'user_id', 'customer_id'
  ];
begin
  if p_order_numbers is null or array_length(p_order_numbers, 1) is null then
    return 0;
  end if;

  for v_number in select distinct unnest(p_order_numbers) loop
    update payment_checkouts
       set snapshot = jsonb_set(snapshot, '{order}', (snapshot -> 'order') - v_pii)
     where order_number = v_number
       and jsonb_typeof(snapshot -> 'order') = 'object';

    update payment_notifications
       set payload = jsonb_set(payload, '{order}', (payload -> 'order') - v_pii)
     where order_number = v_number
       and jsonb_typeof(payload -> 'order') = 'object';

    update payment_receipts
       set evidence = jsonb_build_object('anonymized', true, 'reason', 'customer_erasure')
     where order_number = v_number;

    update paypal_sessions
       set form = jsonb_build_object('anonymized', true, 'reason', 'customer_erasure')::text,
           user_id = null
     where order_number = v_number;

    update orders set notes = null where order_number = v_number;

    update refund_requests set reason = '[redacted]'
     where order_id = (select id from orders where order_number = v_number);

    update email_log
       set to_email = 'deleted-customer@invalid',
           subject = null,
           error = null
     where order_number = v_number;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function public.close_unpaid_order(text, text) from public, anon, authenticated;
revoke all on function public.anonymize_customer_payment_evidence(text[]) from public, anon, authenticated;
grant execute on function public.close_unpaid_order(text, text) to service_role;
grant execute on function public.anonymize_customer_payment_evidence(text[]) to service_role;

notify pgrst, 'reload schema';
commit;
