-- Run after 2026-10-14-payment-reliability.sql. Additive, repeatable; no historical deletes.
begin;
create table if not exists public.checkout_reservations (
  order_number text primary key references payment_checkouts(order_number) on delete restrict,
  state text not null default 'active' check(state in ('active','capturing','consumed','released')),
  coupon_code text,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
alter table checkout_reservations add column if not exists managed_capture boolean not null default false;
create table if not exists public.checkout_stock_reservations (
  order_number text not null references checkout_reservations(order_number) on delete restrict,
  sku_id uuid not null references product_skus(id) on delete restrict,
  quantity int not null check(quantity>0),
  primary key(order_number,sku_id)
);
create table if not exists public.refund_requests (
  order_id uuid primary key references orders(id) on delete restrict,
  manual boolean not null,
  restock boolean not null,
  reason text,
  provider_id text,
  provider_status text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.welcome_coupon_claims (
  token text primary key,
  subscriber_id uuid not null unique references subscribers(id) on delete cascade,
  coupon_code text not null unique,
  email text not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table checkout_reservations enable row level security;
alter table checkout_stock_reservations enable row level security;
alter table refund_requests enable row level security;
alter table welcome_coupon_claims enable row level security;
revoke all on checkout_reservations,checkout_stock_reservations,refund_requests,welcome_coupon_claims from public,anon,authenticated;
grant all on checkout_reservations,checkout_stock_reservations,refund_requests,welcome_coupon_claims to service_role;

-- Retain the previous transaction implementation internally, not as a public bypass.
do $$ begin
  if to_regprocedure('public.prepare_payment_checkout_v1(jsonb,jsonb)') is null then
    alter function public.prepare_payment_checkout(jsonb,jsonb) rename to prepare_payment_checkout_v1;
  end if;
  if to_regprocedure('public.complete_payment_checkout_v1(text,text)') is null then
    alter function public.complete_payment_checkout(text,text) rename to complete_payment_checkout_v1;
  end if;
end $$;

create or replace function public.prepare_payment_checkout(p_order jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order jsonb; v_row record; v_coupon coupons%rowtype;
  v_subtotal numeric; v_discount numeric; v_reserved int; v_code text;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Empty basket';
  end if;
  v_order := prepare_payment_checkout_v1(p_order,p_items);
  -- The v1 function locks the order. Repeated preparation must not reserve twice.
  if exists(select 1 from checkout_reservations where order_number=v_order->>'order_number') then
    if exists(select 1 from checkout_reservations where order_number=v_order->>'order_number' and state='released') then
      raise exception 'Checkout was cancelled';
    end if;
    return v_order;
  end if;
  select sum(quantity*unit_price_gbp) into v_subtotal from order_items where order_id=(v_order->>'id')::uuid;
  v_code := nullif(upper(trim(p_order->>'couponCode')),'');
  if v_code is not null then
    select * into v_coupon from coupons where code=v_code for update;
    if not found or not coalesce(v_coupon.active,false) or
      (v_coupon.expires_at is not null and v_coupon.expires_at<now()) or
      v_subtotal<coalesce(v_coupon.min_order_gbp,0) then raise exception 'Promo code unavailable'; end if;
    select count(*) into v_reserved from checkout_reservations
      where coupon_code=v_code and state in ('active','capturing');
    if v_coupon.max_uses is not null and coalesce(v_coupon.uses_count,0)+v_reserved>=v_coupon.max_uses then
      raise exception 'Promo code already reserved or used';
    end if;
    v_discount := case when v_coupon.discount_type='percentage'
      then round(v_subtotal*v_coupon.discount_value/100,2)
      else least(v_coupon.discount_value,v_subtotal) end;
    v_discount := least(v_discount,greatest(0,v_subtotal-0.30));
    if v_discount is distinct from (p_order->>'discount_gbp')::numeric then
      raise exception 'Promo amount changed';
    end if;
  elsif coalesce((p_order->>'discount_gbp')::numeric,0)<>0 then
    raise exception 'Discount without promo code';
  end if;
  insert into checkout_reservations(order_number,coupon_code,managed_capture)
    values(v_order->>'order_number',v_code,coalesce((p_order->>'managedCapture')::boolean,false));
  for v_row in select sku_id,sum(quantity)::int qty,min(unit_price_gbp) price,max(unit_price_gbp) max_price
    from order_items where order_id=(v_order->>'id')::uuid group by sku_id order by sku_id loop
    if v_row.sku_id is null or v_row.qty<=0 then raise exception 'Invalid SKU/quantity'; end if;
    update product_skus s set stock_qty=s.stock_qty-v_row.qty
      where s.id=v_row.sku_id and s.is_active=true and s.stock_qty>=v_row.qty
        and s.price_gbp=v_row.price and v_row.price=v_row.max_price
        and exists(select 1 from products p where p.id=s.product_id and p.is_active=true);
    if not found then raise exception 'Stock, price or product availability changed'; end if;
    insert into checkout_stock_reservations values(v_order->>'order_number',v_row.sku_id,v_row.qty);
  end loop;
  return v_order;
end $$;

create or replace function public.complete_payment_checkout(p_provider text,p_payment_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_receipt payment_receipts%rowtype; v_order orders%rowtype; v_hold checkout_reservations%rowtype;
  v_row record; v_result jsonb;
begin
  select * into strict v_receipt from payment_receipts where provider=p_provider and payment_id=p_payment_id for update;
  select * into strict v_order from orders where order_number=v_receipt.order_number for update;
  select * into v_hold from checkout_reservations where order_number=v_order.order_number for update;
  if found then
    if v_hold.state='released' then raise exception 'Released checkout requires payment reconciliation'; end if;
    if v_hold.state<>'consumed' then
      perform 1 from coupons where code=v_hold.coupon_code for update;
      -- Stock was deducted during reservation. Restore only inside this transaction,
      -- then let the original finalizer deduct it and write notifications atomically.
      for v_row in select * from checkout_stock_reservations where order_number=v_order.order_number order by sku_id loop
        update product_skus set stock_qty=coalesce(stock_qty,0)+v_row.quantity where id=v_row.sku_id;
        if not found then raise exception 'Reserved SKU missing'; end if;
      end loop;
    end if;
  elsif exists(select 1 from payment_checkouts where order_number=v_order.order_number and completed_at is null) then
    perform 1 from coupons where code=(select snapshot->>'couponCode' from payment_checkouts where order_number=v_order.order_number) for update;
    -- In-flight legacy checkout: never clamp insufficient stock to zero and silently oversell.
    for v_row in select sku_id,sum(quantity)::int qty from order_items
      where order_id=v_order.id and sku_id is not null group by sku_id order by sku_id loop
      perform 1 from product_skus where id=v_row.sku_id and stock_qty>=v_row.qty for update;
      if not found then raise exception 'Legacy payment needs inventory reconciliation'; end if;
    end loop;
  end if;
  v_result := complete_payment_checkout_v1(p_provider,p_payment_id);
  update checkout_reservations set state='consumed' where order_number=v_order.order_number;
  return v_result;
end $$;

create or replace function public.begin_paypal_capture(p_order_number text)
returns void language plpgsql security definer set search_path=public as $$
declare v_hold checkout_reservations%rowtype;
begin
  perform 1 from orders where order_number=p_order_number for update;
  select * into v_hold from checkout_reservations where order_number=p_order_number for update;
  if not found then return; end if; -- Legacy checkout has no reservation.
  if v_hold.state in ('released','consumed') then raise exception 'Checkout no longer capturable'; end if;
  if v_hold.state='active' and v_hold.managed_capture and v_hold.created_at<now()-interval '2 hours' then
    raise exception 'PayPal checkout expired; start a new checkout';
  end if;
  update checkout_reservations set state='capturing' where order_number=p_order_number;
end $$;

-- Call only after confirming Stripe is expired, or before a PayPal capture has begun.
create or replace function public.release_checkout_reservation(p_order_number text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype; v_hold checkout_reservations%rowtype; v_row record;
begin
  select * into strict v_order from orders where order_number=p_order_number for update;
  select * into v_hold from checkout_reservations where order_number=p_order_number for update;
  if v_order.status='cancelled' and v_hold.state='released' then return to_jsonb(v_order); end if;
  if v_order.status<>'pending' then raise exception 'Paid order cannot be cancelled'; end if;
  if exists(select 1 from payment_receipts where order_number=p_order_number) then
    raise exception 'Payment evidence exists; reconcile before cancellation';
  end if;
  if v_hold.order_number is not null and v_hold.state<>'active' then raise exception 'Capture in progress; reconcile first'; end if;
  if v_hold.order_number is not null then
    perform 1 from coupons where code=v_hold.coupon_code for update;
    for v_row in select * from checkout_stock_reservations where order_number=p_order_number order by sku_id loop
      update product_skus set stock_qty=coalesce(stock_qty,0)+v_row.quantity where id=v_row.sku_id;
      if not found then raise exception 'Reserved SKU missing'; end if;
    end loop;
    update checkout_reservations set state='released',released_at=now() where order_number=p_order_number;
  end if;
  update orders set status='cancelled',cancel_reason=p_reason,cancelled_at=now()
    where id=v_order.id returning * into v_order;
  return to_jsonb(v_order);
end $$;

-- Run opportunistically before a new checkout. Never release a capture already started,
-- or holds created by older code that did not claim capture eligibility first.
create or replace function public.release_expired_paypal_reservations()
returns int language plpgsql security definer set search_path=public as $$
declare v_row record; v_count int:=0;
begin
  for v_row in select r.order_number from checkout_reservations r join orders o using(order_number)
    where r.state='active' and r.managed_capture and r.created_at<now()-interval '2 hours'
      and o.payment_method='paypal' and o.status='pending'
      and not exists(select 1 from payment_receipts p where p.order_number=r.order_number)
    order by r.order_number limit 20 loop
    begin
      perform release_checkout_reservation(v_row.order_number,'PayPal 付款等待已过期');
      v_count:=v_count+1;
    exception when raise_exception then
      -- A capture or receipt arrived while scanning. Leave it for reconciliation.
      null;
    end;
  end loop;
  return v_count;
end $$;

create or replace function public.protect_reserved_cancellation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' and exists(
    select 1 from checkout_reservations where order_number=old.order_number and state in ('active','capturing')) then
    raise exception 'Close payment checkout and release reservation before cancellation';
  end if;
  return new;
end $$;
drop trigger if exists protect_reserved_cancellation on orders;
create trigger protect_reserved_cancellation before update of status on orders
  for each row execute function protect_reserved_cancellation();

create or replace function public.begin_order_refund(p_order_id uuid,p_manual boolean,p_restock boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype; v_request refund_requests%rowtype;
begin
  select * into strict v_order from orders where id=p_order_id for update;
  select * into v_request from refund_requests where order_id=p_order_id for update;
  if found then
    if v_request.manual is distinct from p_manual or v_request.restock is distinct from p_restock then
      raise exception 'Refund already started with different options';
    end if;
    return to_jsonb(v_request);
  end if;
  if v_order.status not in ('paid','shipped','delivered') then raise exception 'Order cannot be refunded'; end if;
  insert into refund_requests(order_id,manual,restock,reason)
    values(p_order_id,p_manual,p_restock,p_reason) returning * into v_request;
  return to_jsonb(v_request);
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
  if v_order.status not in ('paid','shipped','delivered') then raise exception 'Order changed during refund'; end if;
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

create or replace function public.claim_welcome_coupon(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sub subscribers%rowtype; v_claim welcome_coupon_claims%rowtype; v_code text;
begin
  -- Lock by token even after subscribers.verify_token is cleared; repeat requests recover the same claim.
  perform pg_advisory_xact_lock(hashtextextended(p_token,1));
  select * into v_claim from welcome_coupon_claims where token=p_token;
  if found then return to_jsonb(v_claim); end if;
  select * into v_sub from subscribers where verify_token=p_token for update;
  if not found then raise exception 'Invalid verification token'; end if;
  if v_sub.verified or v_sub.token_expires_at is null or v_sub.token_expires_at<now() then
    raise exception 'Verification token expired or already used';
  end if;
  v_code:='WELCOME-'||upper(replace(gen_random_uuid()::text,'-',''));
  insert into coupons(code,description,discount_type,discount_value,min_order_gbp,max_uses,uses_count,active,expires_at)
    values(v_code,'Welcome discount for '||v_sub.email,'percentage',10,0,1,0,true,null);
  insert into welcome_coupon_claims(token,subscriber_id,coupon_code,email)
    values(p_token,v_sub.id,v_code,v_sub.email) returning * into v_claim;
  update subscribers set verified=true,status='active',verify_token=null,token_expires_at=null,
    coupon_code=v_code,subscribed_at=now() where id=v_sub.id;
  insert into customers(email) values(v_sub.email)
    on conflict(email) do nothing;
  return to_jsonb(v_claim);
end $$;

revoke all on function public.prepare_payment_checkout_v1(jsonb,jsonb),public.complete_payment_checkout_v1(text,text) from public,anon,authenticated,service_role;
revoke all on function public.prepare_payment_checkout(jsonb,jsonb),public.complete_payment_checkout(text,text),
  public.begin_paypal_capture(text),public.release_checkout_reservation(text,text),
  public.release_expired_paypal_reservations(),
  public.begin_order_refund(uuid,boolean,boolean,text),public.finish_order_refund(uuid),public.claim_welcome_coupon(text)
  from public,anon,authenticated;
grant execute on function public.prepare_payment_checkout(jsonb,jsonb),public.complete_payment_checkout(text,text),
  public.begin_paypal_capture(text),public.release_checkout_reservation(text,text),
  public.release_expired_paypal_reservations(),
  public.begin_order_refund(uuid,boolean,boolean,text),public.finish_order_refund(uuid),public.claim_welcome_coupon(text)
  to service_role;
notify pgrst,'reload schema';
commit;
