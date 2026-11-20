begin;

-- Only call after verifying a terminal PayPal capture failure. The order lock
-- serializes the transition with capture completion and normal cancellation.
create or replace function public.release_failed_paypal_capture(p_paypal_order_id text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_order orders%rowtype;
begin
  select o.* into v_order from orders o
    join paypal_sessions s on s.order_number=o.order_number
    where s.paypal_order_id=p_paypal_order_id and o.payment_method='paypal'
    for update of o;
  if not found or v_order.status<>'pending' then return; end if;

  if exists(select 1 from payment_receipts where order_number=v_order.order_number) then return; end if;

  -- Reuse the existing stock/coupon release in this transaction.
  update checkout_reservations set state='active'
    where order_number=v_order.order_number and state='capturing';
  perform release_checkout_reservation(v_order.order_number, 'PayPal 付款失败');
end $$;

revoke all on function public.release_failed_paypal_capture(text) from public,anon,authenticated;
grant execute on function public.release_failed_paypal_capture(text) to service_role;

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
      -- An existing admin request still needs to apply its selected stock handling.
      provider_status = excluded.provider_status;

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

create or replace function public.finish_order_refund(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype; v_request refund_requests%rowtype; v_row record; v_qty int:=0;
begin
  select * into strict v_order from orders where id=p_order_id for update;
  select * into strict v_request from refund_requests where order_id=p_order_id for update;
  if v_request.completed_at is not null then
    return jsonb_build_object('success',true,'order',to_jsonb(v_order),'already',true);
  end if;
  if not v_request.manual and (v_request.provider_id is null or v_request.provider_status is distinct from 'succeeded') then
    raise exception 'Refund not confirmed by provider';
  end if;
  if v_order.status not in ('paid','shipped','delivered') and
     not (v_order.status='refunded' and v_request.provider_status is not distinct from 'succeeded') then
    raise exception 'Order changed during refund';
  end if;
  if v_request.restock then
    for v_row in select sku_id,sum(quantity)::int qty from order_items
      where order_id=p_order_id group by sku_id order by sku_id loop
      if v_row.sku_id is null then raise exception 'Missing refund SKU; reconcile stock manually'; end if;
      update product_skus set stock_qty=coalesce(stock_qty,0)+v_row.qty where id=v_row.sku_id;
      if not found then raise exception 'Missing refund SKU'; end if;
      v_qty:=v_qty+v_row.qty;
    end loop;
  end if;
  update orders set status='refunded',refund_reason=v_request.reason where id=p_order_id returning * into v_order;
  update refund_requests set completed_at=now() where order_id=p_order_id;
  return jsonb_build_object('success',true,'order',to_jsonb(v_order),'restocked',
    case when v_request.restock then jsonb_build_object('ok',v_qty,'failed',0) else null end);
end $$;

notify pgrst, 'reload schema';
commit;
