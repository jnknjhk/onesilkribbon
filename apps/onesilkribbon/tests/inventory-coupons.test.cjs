const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')
let db
const product='10000000-0000-4000-8000-000000000001'
const sku='10000000-0000-4000-8000-000000000002'
const lastSku='10000000-0000-4000-8000-000000000003'
const token='a'.repeat(64)
const item=(id=sku,qty=2)=>({skuId:id,productId:product,name:'Silk',skuDesc:'7mm',qty,price:10})
const record=(n,cart,code)=>({order_number:n,customer_email:'customer@example.com',
  subtotal_gbp:cart.reduce((n,i)=>n+i.qty*i.price,0),shipping_gbp:0,discount_gbp:code?2:0,
  total_gbp:cart.reduce((n,i)=>n+i.qty*i.price,0)-(code?2:0),shipping_name:'Test Person',
  shipping_line1:'1 Street',shipping_city:'London',shipping_postcode:'A1',shipping_country:'GB',
  payment_method:'stripe',couponCode:code||''})
const prepare=(n,cart=[item()],code)=>db.query('select prepare_payment_checkout($1::jsonb,$2::jsonb) result',
  [JSON.stringify(record(n,cart,code)),JSON.stringify(cart)])
const release=n=>db.query('select release_checkout_reservation($1,$2) result',[n,'Test cancellation'])
const stock=async(id=sku)=>(await db.query('select stock_qty from product_skus where id=$1',[id])).rows[0].stock_qty
const complete=async(n,id,amount=2000)=>{
  await db.query("insert into payment_receipts(provider,payment_id,order_number,amount_pence,currency,evidence) values('stripe',$1,$2,$3,'GBP','{}') on conflict do nothing",[id,n,amount])
  return db.query("select complete_payment_checkout('stripe',$1) result",[id])
}
before(async()=>{
  db=new PGlite()
  await db.exec(`
    create role anon;create role authenticated;create role service_role;
    create table products(id uuid primary key,name text,is_active boolean);
    create table product_skus(id uuid primary key,product_id uuid,stock_qty int,price_gbp numeric,is_active boolean);
    create table orders(id uuid primary key default gen_random_uuid(),order_number text unique,customer_email text not null,
      user_id uuid,status text,subtotal_gbp numeric,vat_amount_gbp numeric,shipping_gbp numeric,discount_gbp numeric,
      total_gbp numeric,shipping_name text not null,shipping_line1 text not null,shipping_line2 text,
      shipping_city text,shipping_postcode text,shipping_country text,phone text,payment_method text,payment_intent_id text,
      paid_at timestamptz,cancel_reason text,cancelled_at timestamptz,refund_reason text,created_at timestamptz default now());
    create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id) on delete cascade,
      product_id uuid references products(id),sku_id uuid references product_skus(id),product_name text not null,
      sku_description text,quantity int,unit_price_gbp numeric,line_total_gbp numeric);
    create table coupons(code text primary key,description text,discount_type text,discount_value numeric,
      min_order_gbp numeric,max_uses int,uses_count int,active boolean,expires_at timestamptz);
    create table subscribers(id uuid primary key default gen_random_uuid(),email text unique,verify_token text unique,
      verified boolean default false,token_expires_at timestamptz,status text,coupon_code text,source text,subscribed_at timestamptz);
    create table customers(email text primary key);
    create table newsletter_subscribers(id uuid primary key default gen_random_uuid(),email text);
    grant all on orders,order_items,newsletter_subscribers to public,anon,authenticated;
    create policy "Old dashboard allow all" on orders for all using(true) with check(true);
    create table paypal_sessions(id uuid primary key default gen_random_uuid(),order_number text);
    insert into products values('${product}','Silk',true);
    insert into product_skus values('${sku}','${product}',100,10,true),('${lastSku}','${product}',1,10,true);
    insert into coupons values('ONCE','One use','percentage',10,0,1,0,true,null);
    insert into subscribers(email,verify_token,token_expires_at) values('welcome@example.com','${token}',now()+interval '1 day');
  `)
  for(const name of ['2026-10-14-payment-reliability.sql','2026-10-14-inventory-coupons.sql','2026-10-14-inventory-coupons.sql']) {
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8'))
  }
  const security=fs.readFileSync(path.join(__dirname,'../supabase/migrations/2026-10-16-audit-security.sql'),'utf8')
  await db.exec(security);await db.exec(security)
})
after(async()=>{await db?.close()})
test('two checkouts competing for the last item: only one gets a reservation',async()=>{
  const results=await Promise.allSettled([prepare('last-a',[item(lastSku,1)]),prepare('last-b',[item(lastSku,1)])])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(await stock(lastSku),0)
  assert.equal((await db.query("select count(*)::int n from orders where order_number in ('last-a','last-b')")).rows[0].n,1)
})
test('split rows cannot reserve more than total available stock',async()=>{
  await assert.rejects(prepare('split',[item(sku,60),item(sku,60)]))
  assert.equal(await stock(),100)
  assert.equal((await db.query("select count(*)::int n from orders where order_number='split'")).rows[0].n,0)
})
test('reservation deducts once, repeated prepare and payment do not double-deduct',async()=>{
  await prepare('reserved');await prepare('reserved')
  assert.equal(await stock(),98)
  await complete('reserved','pi_reserved');await complete('reserved','pi_reserved')
  assert.equal(await stock(),98)
  assert.equal((await db.query("select state from checkout_reservations where order_number='reserved'")).rows[0].state,'consumed')
})
test('cancel releases reservation exactly once',async()=>{
  await prepare('cancelled')
  assert.equal(await stock(),96)
  await release('cancelled');await release('cancelled')
  assert.equal(await stock(),98)
  await assert.rejects(complete('cancelled','pi_late'))
  assert.equal(await stock(),98)
})
test('capture eligibility and cancellation are mutually exclusive',async()=>{
  await prepare('capturing')
  await db.query('select begin_paypal_capture($1)',['capturing'])
  await assert.rejects(release('capturing'))
  assert.equal(await stock(),96)
  await complete('capturing','pi_capturing')
  assert.equal(await stock(),96)
})
test('payment failure keeps reservation and evidence, but no partial stock changes',async()=>{
  await prepare('wrong-payment')
  await assert.rejects(complete('wrong-payment','pi_wrong',1))
  assert.equal(await stock(),94)
  assert.equal((await db.query("select state from checkout_reservations where order_number='wrong-payment'")).rows[0].state,'active')
  assert.equal((await db.query("select count(*)::int n from payment_receipts where payment_id='pi_wrong'")).rows[0].n,1)
})
test('single-use coupon reserves once, cancellation frees slot, payment consumes once',async()=>{
  const results=await Promise.allSettled([prepare('coupon-a',[item()],'ONCE'),prepare('coupon-b',[item()],'ONCE')])
  const winner=results[0].status==='fulfilled'?'coupon-a':'coupon-b'
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  await release(winner)
  await prepare('coupon-c',[item()],'ONCE')
  await complete('coupon-c','pi_coupon',1800);await complete('coupon-c','pi_coupon',1800)
  assert.equal((await db.query("select uses_count from coupons where code='ONCE'")).rows[0].uses_count,1)
  await assert.rejects(prepare('coupon-d',[item()],'ONCE'))
})
test('duplicate verification links issue the same single welcome coupon',async()=>{
  const results=await Promise.all([db.query('select claim_welcome_coupon($1) result',[token]),db.query('select claim_welcome_coupon($1) result',[token])])
  assert.equal(results[0].rows[0].result.coupon_code,results[1].rows[0].result.coupon_code)
  assert.equal((await db.query("select count(*)::int n from coupons where code like 'WELCOME-%'")).rows[0].n,1)
})
test('welcome transaction rolls back coupon AND verification when customer save fails',async()=>{
  const t='b'.repeat(64)
  await db.query("insert into subscribers(email,verify_token,token_expires_at) values('fail@example.com',$1,now()+interval '1 day')",[t])
  await db.exec(`create function fail_customer() returns trigger language plpgsql as $$ begin
    if new.email='fail@example.com' then raise exception 'simulated failure'; end if;return new;end $$;
    create trigger fail_customer before insert on customers for each row execute function fail_customer();`)
  await assert.rejects(db.query('select claim_welcome_coupon($1)',[t]))
  assert.equal((await db.query("select verified from subscribers where email='fail@example.com'")).rows[0].verified,false)
  assert.equal((await db.query("select count(*)::int n from coupons where code like 'WELCOME-%'")).rows[0].n,1)
  await db.exec('drop trigger fail_customer on customers')
  await db.query('select claim_welcome_coupon($1)',[t])
})
test('duplicate manual refunds restock exactly once in same transaction',async()=>{
  const {rows}=await db.query("select id from orders where order_number='reserved'")
  const id=rows[0].id;const before=await stock()
  await Promise.all([db.query("select begin_order_refund($1,true,true,'test')",[id]),db.query("select begin_order_refund($1,true,true,'test')",[id])])
  await Promise.all([db.query('select finish_order_refund($1)',[id]),db.query('select finish_order_refund($1)',[id])])
  assert.equal(await stock(),before+2)
  assert.equal((await db.query('select status from orders where id=$1',[id])).rows[0].status,'refunded')
})
test('unconfirmed automatic refund cannot restock or change paid status',async()=>{
  const {rows}=await db.query("select id from orders where order_number='capturing'")
  const id=rows[0].id;const before=await stock()
  await db.query("select begin_order_refund($1,false,true,'test')",[id])
  await assert.rejects(db.query('select finish_order_refund($1)',[id]))
  assert.equal(await stock(),before)
  await db.query("update refund_requests set provider_id='re_1',provider_status='succeeded' where order_id=$1",[id])
  await db.query('select finish_order_refund($1)',[id]);await db.query('select finish_order_refund($1)',[id])
  assert.equal(await stock(),before+2)
})
test('expired managed PayPal holds release, but capturing and legacy holds stay protected',async()=>{
  for(const name of ['expiry-active','expiry-capturing','expiry-legacy']) {
    const cart=[item()];const data={...record(name,cart),payment_method:'paypal',managedCapture:name!=='expiry-legacy'}
    await db.query('select prepare_payment_checkout($1::jsonb,$2::jsonb)',[JSON.stringify(data),JSON.stringify(cart)])
  }
  await db.query("select begin_paypal_capture('expiry-capturing')")
  await db.exec("update checkout_reservations set created_at=now()-interval '3 hours' where order_number like 'expiry-%'")
  await assert.rejects(db.query("select begin_paypal_capture('expiry-active')"))
  const before=await stock()
  assert.equal((await db.query('select release_expired_paypal_reservations() n')).rows[0].n,1)
  assert.equal(await stock(),before+2)
  assert.equal((await db.query("select state from checkout_reservations where order_number='expiry-capturing'")).rows[0].state,'capturing')
  assert.equal((await db.query("select state from checkout_reservations where order_number='expiry-legacy'")).rows[0].state,'active')
})
test('direct cancellation cannot strand a live reservation',async()=>{
  await prepare('direct-cancel')
  await assert.rejects(db.exec("update orders set status='cancelled' where order_number='direct-cancel'"))
  assert.equal((await db.query("select status from orders where order_number='direct-cancel'")).rows[0].status,'pending')
  await release('direct-cancel')
})
test('refund write failure rolls back stock; retry keeps provider evidence and restocks once',async()=>{
  await prepare('refund-retry');await complete('refund-retry','pi_refund_retry')
  const {rows}=await db.query("select id from orders where order_number='refund-retry'")
  const id=rows[0].id;const before=await stock()
  await db.query("select begin_order_refund($1,false,true,'test')",[id])
  await db.query("update refund_requests set provider_id='re_retry',provider_status='succeeded' where order_id=$1",[id])
  await db.exec(`create function fail_refund() returns trigger language plpgsql as $$ begin
    if new.status='refunded' and new.order_number='refund-retry' then raise exception 'simulated outage'; end if;return new;end $$;
    create trigger fail_refund before update on orders for each row execute function fail_refund();`)
  await assert.rejects(db.query('select finish_order_refund($1)',[id]))
  assert.equal(await stock(),before)
  assert.equal((await db.query('select provider_id from refund_requests where order_id=$1',[id])).rows[0].provider_id,'re_retry')
  await db.exec('drop trigger fail_refund on orders')
  await db.query('select finish_order_refund($1)',[id]);await db.query('select finish_order_refund($1)',[id])
  assert.equal(await stock(),before+2)
})
test('public roles cannot bypass reservations using original functions',async()=>{
  const {rows}=await db.query(`select
    has_function_privilege('anon','claim_welcome_coupon(text)','execute') welcome,
    has_function_privilege('authenticated','release_checkout_reservation(text,text)','execute') release,
    has_function_privilege('service_role','prepare_payment_checkout_v1(jsonb,jsonb)','execute') bypass`)
  assert.deepEqual(rows[0],{welcome:false,release:false,bypass:false})
})

test('audit migration removes arbitrary legacy policies and revokes sensitive-table access without deleting orders',async()=>{
  for(const role of ['anon','authenticated']) for(const table of ['orders','order_items','newsletter_subscribers','stripe_checkout_attempts']) {
    const {rows}=await db.query('select has_table_privilege($1,$2,\'select,insert,update,delete\') allowed',[role,table])
    assert.equal(rows[0].allowed,false,`${role}/${table}`)
  }
  assert.equal((await db.query("select count(*)::int n from pg_policies where tablename in ('orders','order_items','newsletter_subscribers')")).rows[0].n,0)
  assert.equal((await db.query("select count(*)::int n from orders where order_number='reserved'")).rows[0].n,1)
})

test('Stripe preparation and durable attempt roll back together on persistence failure',async()=>{
  await db.exec(`create function reject_stripe_attempt() returns trigger language plpgsql as $$ begin raise exception 'attempt insert failed'; end $$;
    create trigger reject_stripe_attempt before insert on stripe_checkout_attempts for each row execute function reject_stripe_attempt();`)
  const before=await stock()
  try {
    await assert.rejects(db.query('select prepare_stripe_checkout($1::jsonb,$2::jsonb,now()+interval \'45 minutes\',$3)',
      [JSON.stringify(record('atomic-failure',[item()])),JSON.stringify([item()]),'a'.repeat(64)]))
    assert.equal(await stock(),before)
    assert.equal((await db.query("select count(*)::int n from orders where order_number='atomic-failure'")).rows[0].n,0)
  } finally { await db.exec('drop trigger reject_stripe_attempt on stripe_checkout_attempts; drop function reject_stripe_attempt()') }
})

test('unstarted Stripe preparation releases once; cancellation prevents provider start',async()=>{
  const before=await stock()
  await db.query('select prepare_stripe_checkout($1::jsonb,$2::jsonb,now()+interval \'45 minutes\',$3)',
    [JSON.stringify(record('stripe-never-started',[item()])),JSON.stringify([item()]),'a'.repeat(64)])
  assert.equal(await stock(),before-2)
  await db.query("select release_unstarted_stripe_checkout('stripe-never-started')")
  await db.query("select release_unstarted_stripe_checkout('stripe-never-started')")
  assert.equal(await stock(),before)
  await assert.rejects(db.query("select begin_stripe_creation('stripe-never-started')"))
})

test('started Stripe attempt cannot be reclaimed by local cleanup or unstarted guard',async()=>{
  await db.query('select prepare_stripe_checkout($1::jsonb,$2::jsonb,now()+interval \'45 minutes\',$3)',
    [JSON.stringify(record('stripe-started',[item()])),JSON.stringify([item()]),'a'.repeat(64)])
  await db.query("select begin_stripe_creation('stripe-started')")
  await db.exec("update stripe_checkout_attempts set created_at=now()-interval '5 minutes' where order_number='stripe-started'")
  const before=await stock()
  await assert.rejects(db.query("select release_unstarted_stripe_checkout('stripe-started')"))
  await db.query('select release_abandoned_stripe_preparations()')
  assert.equal(await stock(),before)
  assert.equal((await db.query("select state from checkout_reservations where order_number='stripe-started'")).rows[0].state,'active')
  for(const role of ['anon','authenticated']) {
    assert.equal((await db.query("select has_function_privilege($1,'begin_stripe_creation(text)','execute') allowed",[role])).rows[0].allowed,false)
  }
})

function pricing({qty=2,active=true}={}) {
  const source=fs.readFileSync(path.join(__dirname,'../lib/order-pricing.js'),'utf8')
    .replace(/^import .*$/gm,'').replace('export async function','async function')
  const mock={rpc:async()=>({error:null}),from(table){const q={select(){return q},in:async()=>({data:table==='products'
    ?[{id:product,name:'Real product',is_active:active}]
    :[{id:sku,product_id:product,price_gbp:10,stock_qty:qty,is_active:true,width_mm:7,colour:'Blue',length_m:10}]})};return q}}
  const moneySource=fs.readFileSync(path.join(__dirname,'../lib/pricing.js'),'utf8').replace(/^export /gm,'')
  const money=new Function(moneySource+';return {calculateTotals,gbpToPence,penceToGBP,cartSubtotalPence,couponDiscountPence}')()
  const bindings={supabaseAdmin:mock,...money}
  return new Function(...Object.keys(bindings),source+';return computeAuthoritativeOrder')(...Object.values(bindings))
}
test('pricing merges duplicate lines and uses database product identity',async()=>{
  const run=pricing()
  const result=await run({items:[{skuId:sku,qty:1,name:'Fake',productId:'fake'},{skuId:sku,qty:1}],shippingSettings:{}})
  assert.equal(result.ok,true);assert.equal(result.lineItems.length,1);assert.equal(result.lineItems[0].qty,2)
  assert.equal(result.lineItems[0].productId,product);assert.equal(result.lineItems[0].name,'Real product')
  assert.equal((await pricing({qty:1})({items:[{skuId:sku,qty:1},{skuId:sku,qty:1}],shippingSettings:{}})).ok,false)
})
test('fractional, negative and invalid quantities and inactive products are rejected',async()=>{
  for(const qty of [0,-1,1.5,'abc',null,Infinity,true]) assert.equal((await pricing()({items:[{skuId:sku,qty}],shippingSettings:{}})).ok,false)
  assert.equal((await pricing({active:false})({items:[{skuId:sku,qty:1}],shippingSettings:{}})).ok,false)
})

function load(file,bindings,exported) {
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8')
    .replace(/^import .*$/gm,'').replace(/export async function/g,'async function')
  return new Function(...Object.keys(bindings),source+`;return ${exported}`)(...Object.values(bindings))
}
test('refund provider response lost: retry finds existing refund instead of creating another',async()=>{
  let savedRefund=null;let creations=0;let finishes=0
  const order={id:'test-order',payment_method:'stripe',payment_intent_id:'pi_test'}
  const POST=load('app/api/admin/refund/route.js',{
    verifyAdmin:async()=>({email:'admin'}),
    supabaseAdmin:{from(table){const q={select(){return q},eq(){return q},single:async()=>({data:order}),
      update(){return {eq:async()=>({error:null})}}};return q},
      rpc:async name=>({data:name==='begin_order_refund'?{manual:false,restock:true}:(finishes++,{success:true})})},
    Stripe:class {refunds={list:async()=>({data:savedRefund?[savedRefund]:[]}),
      create:async(_body,options)=>{assert.equal(options.idempotencyKey,'order-refund/test-order');creations++;
        savedRefund={id:'re_saved',status:'succeeded',payment_intent:'pi_test',metadata:{osr_order_id:'test-order'}};
        throw Error('response lost')}}},
    errorResponse:()=>Response.json({error:'retry'},{status:409}),
  },'POST')
  const req={json:async()=>({orderId:'test-order',manual:false,restock:true})}
  assert.equal((await POST(req)).status,409)
  assert.equal((await POST(req)).status,200)
  assert.equal(creations,1);assert.equal(finishes,1)
})
test('cannot release Stripe reservation while provider still reports a payable link',async()=>{
  let releases=0
  const cancel=load('lib/checkout-cancel.js',{
    reconcileStripeReservation:async()=>{throw Error('network down')},
    supabaseAdmin:{rpc:async()=>{releases++}},
    Stripe:class {checkout={sessions:{retrieve:async()=>({id:'cs_test',status:'open',payment_status:'unpaid'}),
      expire:async()=>{throw Error('network down')}}}},
  },'cancelUnpaidOrder')
  await assert.rejects(cancel({status:'pending',payment_method:'stripe',payment_intent_id:'cs_test'},'test'))
  assert.equal(releases,0)
})
