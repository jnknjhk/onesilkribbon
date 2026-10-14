-- Additive migration. Never deletes or rewrites historical orders.
begin;
create table if not exists public.payment_checkouts (
  order_number text primary key references public.orders(order_number) on delete restrict,
  snapshot jsonb not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.payment_receipts (
  provider text not null check (provider in ('stripe','paypal')),
  payment_id text not null,
  order_number text not null,
  amount_pence bigint not null,
  currency text not null,
  evidence jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (provider, payment_id)
);
create table if not exists public.payment_notifications (
  order_number text primary key references public.orders(order_number) on delete restrict,
  payload jsonb not null,
  customer_sent_at timestamptz,
  owner_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.payment_checkouts enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.payment_notifications enable row level security;
revoke all on public.payment_checkouts, public.payment_receipts, public.payment_notifications from anon, authenticated;
grant all on public.payment_checkouts, public.payment_receipts, public.payment_notifications to service_role;

-- Maintenance must not remove the only recoverable provider/session association.
create or replace function public.protect_payment_session()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists(select 1 from payment_checkouts where order_number=old.order_number)
    or exists(select 1 from payment_receipts where order_number=old.order_number) then
    raise exception 'Payment session is retained for reconciliation';
  end if;
  return old;
end $$;
drop trigger if exists protect_payment_session on public.paypal_sessions;
create trigger protect_payment_session before delete on public.paypal_sessions
  for each row execute function public.protect_payment_session();

-- Older maintenance code tries deleting items first after an FK error. Block that too.
create or replace function public.protect_payment_items()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists(select 1 from orders o join payment_checkouts c on c.order_number=o.order_number
    where o.id=old.order_id) then
    raise exception 'Checkout items are retained for reconciliation';
  end if;
  return old;
end $$;
drop trigger if exists protect_payment_items on public.order_items;
create trigger protect_payment_items before delete on public.order_items
  for each row execute function public.protect_payment_items();

create or replace function public.prepare_payment_checkout(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Empty order items';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_order->>'order_number', 0));
  select * into v_order from orders where order_number = p_order->>'order_number' for update;
  if found then
    if v_order.status <> 'pending' and not (v_order.status='cancelled' and v_order.cancel_reason='支付失败') then
      raise exception 'Order is not pending';
    end if;
    -- Adoption of an existing Stripe order must never replace its saved items.
    if not exists (select 1 from order_items where order_id = v_order.id) then
      raise exception 'Existing order has no items; manual reconciliation required';
    end if;
  else
    insert into orders (order_number,customer_email,user_id,status,subtotal_gbp,vat_amount_gbp,
      shipping_gbp,discount_gbp,total_gbp,shipping_name,shipping_line1,shipping_line2,
      shipping_city,shipping_postcode,shipping_country,phone,payment_method)
    values (p_order->>'order_number',p_order->>'customer_email',(p_order->>'user_id')::uuid,
      'pending',(p_order->>'subtotal_gbp')::numeric,0,(p_order->>'shipping_gbp')::numeric,
      (p_order->>'discount_gbp')::numeric,(p_order->>'total_gbp')::numeric,
      p_order->>'shipping_name',p_order->>'shipping_line1',p_order->>'shipping_line2',
      p_order->>'shipping_city',p_order->>'shipping_postcode',p_order->>'shipping_country',
      p_order->>'phone',p_order->>'payment_method') returning * into v_order;
    for v_item in select value from jsonb_array_elements(p_items) loop
      if (v_item->>'qty')::int <= 0 then raise exception 'Invalid quantity'; end if;
      insert into order_items(order_id,product_id,sku_id,product_name,sku_description,quantity,unit_price_gbp,line_total_gbp)
      values(v_order.id,(v_item->>'productId')::uuid,(v_item->>'skuId')::uuid,v_item->>'name',
        coalesce(v_item->>'skuDesc',''),(v_item->>'qty')::int,(v_item->>'price')::numeric,
        (v_item->>'qty')::int*(v_item->>'price')::numeric);
    end loop;
  end if;
  insert into payment_checkouts(order_number,snapshot)
    values(v_order.order_number,jsonb_build_object('order',to_jsonb(v_order),'items',p_items,
      'couponCode',p_order->>'couponCode')) on conflict do nothing;
  return to_jsonb(v_order);
end $$;

create or replace function public.complete_payment_checkout(p_provider text,p_payment_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_receipt payment_receipts%rowtype; v_order orders%rowtype;
  v_checkout payment_checkouts%rowtype; v_item record; v_items jsonb;
begin
  select * into strict v_receipt from payment_receipts
    where provider=p_provider and payment_id=p_payment_id for update;
  select * into strict v_order from orders where order_number=v_receipt.order_number for update;
  if v_order.payment_method <> p_provider or v_receipt.currency <> 'GBP'
    or v_receipt.amount_pence <> round(v_order.total_gbp*100)::bigint then
    raise exception 'Payment does not match order';
  end if;
  select * into v_checkout from payment_checkouts where order_number=v_order.order_number for update;
  if not found then raise exception 'Missing checkout snapshot'; end if;
  if v_checkout.completed_at is not null then
    if v_order.payment_intent_id <> p_payment_id then raise exception 'Different payment already recorded'; end if;
    update payment_receipts set processed_at=coalesce(processed_at,now())
      where provider=p_provider and payment_id=p_payment_id;
    return to_jsonb(v_order);
  end if;
  if v_order.status <> 'pending' and not (v_order.status='cancelled' and v_order.cancel_reason='支付失败') then
    raise exception 'Order requires manual reconciliation';
  end if;
  if not exists(select 1 from order_items where order_id=v_order.id) then raise exception 'Missing items'; end if;
  -- Stable lock order avoids deadlocks across carts. These changes and paid status commit together.
  for v_item in select sku_id,sum(quantity)::int as qty from order_items
    where order_id=v_order.id and sku_id is not null group by sku_id order by sku_id loop
    update product_skus set stock_qty=greatest(0,coalesce(stock_qty,0)-v_item.qty) where id=v_item.sku_id;
    if not found then raise exception 'Missing SKU'; end if;
  end loop;
  update coupons set uses_count=coalesce(uses_count,0)+1
    where code=upper(trim(v_checkout.snapshot->>'couponCode'));
  update orders set status='paid',paid_at=now(),payment_intent_id=p_payment_id,
    cancel_reason=null,cancelled_at=null where id=v_order.id returning * into v_order;
  select jsonb_agg(jsonb_build_object('name',product_name,'skuDesc',sku_description,
    'qty',quantity,'price',unit_price_gbp)) into v_items from order_items where order_id=v_order.id;
  insert into payment_notifications(order_number,payload)
    values(v_order.order_number,jsonb_build_object('order',to_jsonb(v_order),'items',v_items)) on conflict do nothing;
  update payment_checkouts set completed_at=now() where order_number=v_order.order_number;
  update payment_receipts set processed_at=now() where provider=p_provider and payment_id=p_payment_id;
  return to_jsonb(v_order);
end $$;
revoke all on function public.prepare_payment_checkout(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.complete_payment_checkout(text,text) from public,anon,authenticated;
grant execute on function public.prepare_payment_checkout(jsonb,jsonb) to service_role;
grant execute on function public.complete_payment_checkout(text,text) to service_role;
notify pgrst,'reload schema';
commit;
