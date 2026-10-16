const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
let db
const sku = '00000000-0000-4000-8000-000000000001'
const product = '00000000-0000-4000-8000-000000000002'
const items = [{ skuId: sku, productId: product, name: 'Silk', skuDesc: '7mm', qty: 2, price: 10 }]
const order = n => ({ order_number: n, customer_email: 'customer@example.com',
  subtotal_gbp: '20', shipping_gbp: '0', discount_gbp: '0', total_gbp: '20',
  shipping_name: 'Test Customer', shipping_line1: '1 Street', shipping_city: 'London',
  shipping_postcode: 'A1', shipping_country: 'GB', payment_method: 'stripe', couponCode: 'TEST' })
async function prepare(n, cart = items) {
  return db.query('select prepare_payment_checkout($1::jsonb,$2::jsonb)', [JSON.stringify(order(n)), JSON.stringify(cart)])
}
async function receipt(n, id, amount = 2000) {
  await db.query("insert into payment_receipts(provider,payment_id,order_number,amount_pence,currency,evidence) values('stripe',$1,$2,$3,'GBP','{}')", [id,n,amount])
}
const complete = id => db.query("select complete_payment_checkout('stripe',$1)", [id])
before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table products(id uuid primary key);
    create table product_skus(id uuid primary key,stock_qty int);
    create table orders(id uuid primary key default gen_random_uuid(),order_number text unique,
      customer_email text not null,user_id uuid,status text,subtotal_gbp numeric,vat_amount_gbp numeric,
      shipping_gbp numeric,discount_gbp numeric,total_gbp numeric,shipping_name text not null,
      shipping_line1 text not null,shipping_line2 text,shipping_city text not null,shipping_postcode text,
      shipping_country text,phone text,payment_method text,payment_intent_id text,paid_at timestamptz,
      cancel_reason text,cancelled_at timestamptz,created_at timestamptz default now());
    create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id) on delete cascade,
      product_id uuid references products(id),sku_id uuid references product_skus(id),product_name text not null,
      sku_description text,quantity int,unit_price_gbp numeric,line_total_gbp numeric);
    create table coupons(code text primary key,uses_count int);
    create table paypal_sessions(id uuid primary key default gen_random_uuid(),order_number text);
    insert into products values('${product}');
    insert into product_skus values('${sku}',100);
    insert into coupons values('TEST',0);
  `)
  const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/2026-10-14-payment-reliability.sql'), 'utf8')
  await db.exec(migration)
  await db.exec(migration) // Repeatable migration must preserve existing schema/data.
})
after(async () => { await db?.close() })

test('item insert failure rolls back order AND snapshot', async () => {
  await assert.rejects(prepare('broken', [{ ...items[0], productId: '00000000-0000-4000-8000-000000000099' }]))
  assert.equal((await db.query("select count(*)::int n from orders where order_number='broken'")).rows[0].n, 0)
  assert.equal((await db.query("select count(*)::int n from payment_checkouts where order_number='broken'")).rows[0].n, 0)
})
test('duplicate and concurrent finalization deduct stock/coupon exactly once', async () => {
  await prepare('duplicate'); await receipt('duplicate','pi_duplicate')
  await Promise.all([complete('pi_duplicate'), complete('pi_duplicate')])
  assert.equal((await db.query(`select stock_qty from product_skus where id='${sku}'`)).rows[0].stock_qty,98)
  assert.equal((await db.query("select uses_count from coupons where code='TEST'")).rows[0].uses_count,1)
  assert.equal((await db.query("select count(*)::int n from payment_notifications where order_number='duplicate'")).rows[0].n,1)
})
test('failure after stock update rolls back everything; saved receipt survives and retry completes', async () => {
  await prepare('retry'); await receipt('retry','pi_retry')
  await db.exec(`create function test_fail_notification() returns trigger language plpgsql as $$
    begin if new.order_number='retry' then raise exception 'simulated outage'; end if; return new; end $$;
    create trigger test_failure before insert on payment_notifications for each row execute function test_fail_notification();`)
  await assert.rejects(complete('pi_retry'))
  assert.equal((await db.query("select status from orders where order_number='retry'")).rows[0].status,'pending')
  assert.equal((await db.query(`select stock_qty from product_skus where id='${sku}'`)).rows[0].stock_qty,98)
  assert.equal((await db.query("select processed_at from payment_receipts where payment_id='pi_retry'")).rows[0].processed_at,null)
  await db.exec('drop trigger test_failure on payment_notifications')
  await complete('pi_retry')
  assert.equal((await db.query("select status from orders where order_number='retry'")).rows[0].status,'paid')
  assert.equal((await db.query(`select stock_qty from product_skus where id='${sku}'`)).rows[0].stock_qty,96)
})
test('wrong amount cannot finalize or erase payment evidence', async () => {
  await prepare('wrong-amount'); await receipt('wrong-amount','pi_wrong',1)
  await assert.rejects(complete('pi_wrong'))
  assert.equal((await db.query("select status from orders where order_number='wrong-amount'")).rows[0].status,'pending')
  assert.equal((await db.query("select count(*)::int n from payment_receipts where payment_id='pi_wrong'")).rows[0].n,1)
})
test('a second payment cannot repeat fulfillment', async () => {
  await receipt('duplicate','pi_second')
  await assert.rejects(complete('pi_second'))
})
test('maintenance cannot delete protected orders, items by cascade, or sessions', async () => {
  await db.exec("insert into paypal_sessions(order_number) values('retry')")
  await assert.rejects(db.exec("delete from paypal_sessions where order_number='retry'"))
  await assert.rejects(db.exec("delete from orders where order_number='retry'"))
  await assert.rejects(db.exec("delete from order_items where order_id=(select id from orders where order_number='retry')"))
  assert.equal((await db.query("select count(*)::int n from order_items i join orders o on o.id=i.order_id where o.order_number='retry'")).rows[0].n,1)
})
test('payment functions and evidence tables are not accessible to public roles', async () => {
  const { rows } = await db.query(`select
    has_function_privilege('anon','prepare_payment_checkout(jsonb,jsonb)','EXECUTE') as prepare,
    has_function_privilege('authenticated','complete_payment_checkout(text,text)','EXECUTE') as complete,
    has_table_privilege('anon','payment_receipts','SELECT') as receipts`)
  assert.deepEqual(rows[0],{prepare:false,complete:false,receipts:false})
})

function loadRoute(file, bindings, exported = 'POST') {
  const source = fs.readFileSync(path.join(__dirname, '..', file),'utf8')
    .replace(/^import .*$/gm,'').replace(/export async function/g,'async function').replace(/^export (?=const |function )/gm,'')
  return new Function(...Object.keys(bindings), source + `;return ${exported}`)(...Object.values(bindings))
}
test('Stripe never creates a payable link if order preparation fails', async () => {
  let providerCalls=0
  const POST=loadRoute('app/api/stripe/create-checkout-session/route.js', {
    Stripe: class { constructor(){providerCalls++} }, getAuthUser:async()=>null,
    checkoutForm:x=>x,refreshCheckoutReservations:async()=>{},
    computeAuthoritativeOrder:async()=>({ok:true,lineItems:items,totals:{total:20}}),
    newOrderNumber:()=> 'failure',orderRecord:()=>({}), prepareStripeOrder:async()=>{throw Error('database down')},
    errorResponse:()=>Response.json({error:'unavailable'},{status:503}),
  })
  assert.equal((await POST({json:async()=>({items,form:{email:'test@example.com'}})})).status,503)
  assert.equal(providerCalls,0)
})
test('Stripe finalization failures return 503 for provider retries', async () => {
  const event={type:'checkout.session.completed',data:{object:{payment_status:'paid',metadata:{orderNumber:'retry'},payment_intent:'pi',amount_total:2000,currency:'gbp'}}}
  const POST=loadRoute('app/api/stripe/webhook/route.js',{
    Stripe:class { webhooks={constructEvent:()=>event} },recordPayment:async()=>{throw Error('database down')},
    errorResponse:(_e,options)=>Response.json({error:'retry'},{status:options.status}),
  })
  assert.equal((await POST({text:async()=>'',headers:new Headers()})).status,503)
})

function paypalBindings(overrides = {}) {
  const session={paypal_order_id:'PP1',items:JSON.stringify(items),form:'{}',totals:'{}'}
  return {
    supabaseAdmin:{ rpc:async()=>({error:null}), from(table){ const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:
      table==='paypal_sessions'?session:table==='payment_checkouts'?{order_number:'pp-order'}:{status:'pending'}})};return q } },
    recordPayment:async()=>{},completeOrder:async()=>{},deliverNotifications:async()=>{},
    fetch:async url=>Response.json(url.endsWith('token')?{access_token:'access'}:{
      id:'PP1',status:'COMPLETED',purchase_units:[{reference_id:'pp-order',payments:{captures:[{
        id:'CAP1',status:'COMPLETED',amount:{value:'20.00',currency_code:'GBP'},
      }]}}],
    }),
    ...overrides,
  }
}
test('PayPal rejects mismatched identity before making any provider call', async()=>{
  let calls=0
  const recover=loadRoute('lib/paypal-payment.js',paypalBindings({fetch:async()=>{calls++}}),'recoverPayPal')
  await assert.rejects(recover('pp-order','ATTACKER'))
  assert.equal(calls,0)
})
test('already captured PayPal payment is retrieved and finalized without recapturing',async()=>{
  const defaults=paypalBindings();let captures=0;let completions=0
  const recover=loadRoute('lib/paypal-payment.js',paypalBindings({
    fetch:async(url,opts)=>{if(url.endsWith('/capture'))captures++;return defaults.fetch(url,opts)},
    completeOrder:async()=>{completions++},
  }),'recoverPayPal')
  await recover('pp-order','PP1');await recover('pp-order','PP1')
  assert.equal(captures,0);assert.equal(completions,2)
})
test('PayPal capture response lost after payment: retrieve state and recover',async()=>{
  const defaults=paypalBindings();let paid=false;let captures=0;let completed=0
  const recover=loadRoute('lib/paypal-payment.js',paypalBindings({
    fetch:async(url,opts)=>{
      if(url.endsWith('/capture')){captures++;paid=true;throw Error('connection lost')}
      if(!url.endsWith('token')&&!paid)return Response.json({id:'PP1',status:'APPROVED'})
      return defaults.fetch(url,opts)
    },completeOrder:async()=>{completed++},
  }),'recoverPayPal')
  await recover('pp-order','PP1');await recover('pp-order','PP1')
  assert.equal(captures,1);assert.equal(completed,2)
})
test('PayPal session save failure never returns approval URL',async()=>{
  const defaults=paypalBindings()
  const POST=loadRoute('app/api/paypal/create-order/route.js',{
    ...defaults,getAuthUser:async()=>null,newOrderNumber:()=> 'pp-order',orderRecord:()=>({}),prepareOrder:async()=>{},
    checkoutForm:x=>x,refreshCheckoutReservations:async()=>{},
    computeAuthoritativeOrder:async()=>({ok:true,lineItems:items,totals:{total:20,shipping:0}}),
    fetch:async url=>Response.json(url.endsWith('token')?{access_token:'access'}:{id:'PP1',links:[{rel:'approve',href:'https://paypal.example/pay'}]}),
    supabaseAdmin:{from:()=>({insert:async()=>({error:Error('database down')})})},
    errorResponse:()=>Response.json({error:'retry'},{status:503}),
  })
  const response=await POST({json:async()=>({items,form:{email:'customer@example.com'}})})
  assert.equal(response.status,503);assert.equal((await response.json()).approvalUrl,undefined)
})

test('notification retry retains independent progress and retries only unsent message',async()=>{
  const job={order_number:'notify',payload:{order:{order_number:'notify',shipping_name:'Test Person',shipping_gbp:0},items:[]}}
  let customers=0;let owners=0
  const deliver=loadRoute('lib/payment-orders.js',{
    supabaseAdmin:{from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:job}),
      update(patch){Object.assign(job,patch);return {eq:async()=>({error:null})}}};return q}},
    sendOrderConfirmation:async()=>{customers++},
    sendOwnerNotification:async()=>{owners++;if(owners===1)throw Error('email outage')},
  },'deliverNotifications')
  await assert.rejects(deliver('notify'))
  assert.ok(job.customer_sent_at);assert.equal(job.owner_sent_at,undefined)
  await deliver('notify')
  assert.equal(customers,1);assert.equal(owners,2);assert.ok(job.owner_sent_at)
})
test('Stripe binding failure expires the session and never returns its URL',async()=>{
  let expired=0
  const POST=loadRoute('app/api/stripe/create-checkout-session/route.js',{
    Stripe:class {checkout={sessions:{create:async()=>({id:'cs1',url:'https://stripe.example/pay'}),expire:async()=>{expired++}}}},
    supabaseAdmin:{from(){const q={insert:async()=>({}),update(){return q},eq(){return q},select(){return q},single:async()=>({error:Error('write failed')})};return q}},
    checkoutForm:x=>x,refreshCheckoutReservations:async()=>{},beginStripeCreation:async()=>{},
    releaseFailedStripeCreation:async({stripe,session})=>{await stripe.checkout.sessions.expire(session.id)},
    getAuthUser:async()=>null,computeAuthoritativeOrder:async()=>({ok:true,lineItems:items,totals:{total:20}}),
    newOrderNumber:()=> 'binding',orderRecord:()=>({}),prepareStripeOrder:async()=>{},gbpToPence:()=>2000,
    errorResponse:()=>Response.json({error:'retry'},{status:503}),
  })
  const response=await POST({json:async()=>({items,form:{email:'customer@example.com'}})})
  assert.equal(response.status,503);assert.equal(expired,1);assert.equal((await response.json()).url,undefined)
})
