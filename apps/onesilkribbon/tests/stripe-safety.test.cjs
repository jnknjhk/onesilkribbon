const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
function load(file, bindings, symbol) {
  const source = fs.readFileSync(path.join(__dirname,'..',file),'utf8')
    .replace(/^import .*$/gm,'').replace(/^export /gm,'')
  return new Function(...Object.keys(bindings),source+`;return ${symbol}`)(...Object.values(bindings))
}
const form = { email:'buyer@example.org',firstName:'Test',lastName:'Buyer',line1:'1 Street',city:'London',country:'GB' }
const checkoutForm = load('lib/checkout-form.js', {}, 'checkoutForm')
process.env.STRIPE_SECRET_KEY = 'sk_test_unit_tests_only'
const { createHash } = require('node:crypto')
const scope = createHash('sha256').update(process.env.STRIPE_SECRET_KEY).digest('hex')
test('invalid contact data is rejected before checkout; fields are normalized and bounded', () => {
  for (const value of [null, [], { ...form,email:'not-an-email' }, { ...form,firstName:{} }, { ...form,line1:'x'.repeat(201) }, { ...form,city:'a\nb' }]) {
    assert.throws(()=>checkoutForm(value),{code:'INVALID_CHECKOUT_FORM'})
  }
  assert.equal(checkoutForm({ ...form,email:' BUYER@EXAMPLE.ORG ',country:'gb' }).email,'buyer@example.org')
})

function harness({ order = {}, attempt = {}, sessions = [], expireError = false, listError = false, hasMore = false } = {}) {
  const counters = { releases:0, records:0, completions:0, expires:0 }
  const actualOrder = { order_number:'test',status:'pending',payment_method:'stripe',total_gbp:20,payment_intent_id:null,created_at:'2026-10-01T00:00:00Z',...order }
  const actualAttempt = attempt === null ? null : { created_at:'2026-10-01T00:00:00Z',expires_at:'2026-10-01T00:30:00Z',provider_scope:scope,provider_started_at:'2026-10-01T00:00:01Z',...attempt }
  const db = {
    rpc:async()=>{counters.releases++;return {}},
    from(table) { const q={select(){return q},eq(){return q},is:async()=>({}),update(){return q},
      single:async()=>({data:actualOrder}),maybeSingle:async()=>({data:table==='stripe_checkout_attempts'?actualAttempt:actualOrder})};return q },
  }
  const stripe = { checkout:{sessions:{
    retrieve:async()=>sessions[0],
    list:async()=>{if(listError)throw Error('lookup unavailable');return {data:sessions,has_more:hasMore}},
    expire:async id=>{counters.expires++;if(expireError)throw Error('expire unavailable');return {id,status:'expired',payment_status:'unpaid'}},
  }} }
  const binding = { supabaseAdmin:db, createHash, Stripe:class{}, recordPayment:async()=>{counters.records++},
    completeOrder:async()=>{counters.completions++},deliverNotifications:async()=>{} }
  return { counters,db,stripe,release:load('lib/stripe-reservations.js',binding,'releaseFailedStripeCreation'),
    reconcile:load('lib/stripe-reservations.js',binding,'reconcileStripeReservation') }
}
test('definite provider rejection releases stock, but ambiguous timeout does not', async () => {
  const h=harness()
  assert.equal(await h.release({orderNumber:'test',attempted:true,error:{type:'StripeInvalidRequestError',statusCode:400}}),true)
  assert.equal(h.counters.releases,1)
  assert.equal(await h.release({orderNumber:'test',attempted:true,error:{type:'StripeConnectionError'}}),false)
  assert.equal(h.counters.releases,1)
  assert.equal(await h.release({orderNumber:'test',attempted:false,error:Error('local database error')}),true)
  assert.equal(h.counters.releases,2)
})
test('binding failure closes known unpaid session before releasing; uncertain closure retains stock', async () => {
  const h=harness()
  await h.release({orderNumber:'test',stripe:h.stripe,session:{id:'cs_test',status:'open',payment_status:'unpaid'},attempted:true})
  assert.equal(h.counters.expires,1);assert.equal(h.counters.releases,1)
  const failed=harness({sessions:[{id:'cs_test',status:'open',payment_status:'unpaid'}],expireError:true})
  await assert.rejects(failed.release({orderNumber:'test',stripe:failed.stripe,session:{id:'cs_test',status:'open'},attempted:true}))
  assert.equal(failed.counters.releases,0)
})
test('lost creation response: complete provider absence check after saved deadline can recover stock', async () => {
  const h=harness()
  assert.equal((await h.reconcile('test',{stripe:h.stripe})).status,'cancelled')
  assert.equal(h.counters.releases,1)
  const recent=harness({attempt:{expires_at:new Date(Date.now()+600000).toISOString()}})
  await assert.rejects(recent.reconcile('test',{stripe:recent.stripe}))
  assert.equal(recent.counters.releases,0)
})
test('failed/truncated provider listings and legacy missing deadlines never count as absence', async () => {
  for(const options of [{listError:true},{hasMore:true},{attempt:null}]) {
    const h=harness(options)
    await assert.rejects(h.reconcile('test',{stripe:h.stripe}))
    assert.equal(h.counters.releases,0)
  }
})
test('unbound paid session is recovered without charging or restoring stock', async () => {
  const h=harness({sessions:[{id:'cs_paid',status:'complete',payment_status:'paid',payment_intent:'pi_paid',currency:'gbp',amount_total:2000,metadata:{orderNumber:'test'}}]})
  assert.equal((await h.reconcile('test',{stripe:h.stripe})).status,'paid')
  assert.equal(h.counters.records,1);assert.equal(h.counters.completions,1)
  assert.equal(h.counters.releases,0);assert.equal(h.counters.expires,0)
})
test('open link remains reserved until confirmed expired; mismatched amounts cannot be released', async () => {
  const session={id:'cs_open',status:'open',payment_status:'unpaid',currency:'gbp',amount_total:2000,metadata:{orderNumber:'test'}}
  const h=harness({sessions:[session]})
  assert.equal((await h.reconcile('test',{stripe:h.stripe})).status,'pending')
  assert.equal(h.counters.releases,0)
  assert.equal((await h.reconcile('test',{stripe:h.stripe,cancel:true})).status,'cancelled')
  const wrong=harness({sessions:[{...session,amount_total:1}]})
  await assert.rejects(wrong.reconcile('test',{stripe:wrong.stripe,cancel:true}))
  assert.equal(wrong.counters.releases,0)
})
test('Stripe creation route rejects invalid form without preparing stock or contacting provider', async () => {
  let prepared=0
  const POST=load('app/api/stripe/create-checkout-session/route.js',{
    checkoutForm,refreshCheckoutReservations:async()=>{},prepareStripeOrder:async()=>{prepared++},
    errorResponse:()=>Response.json({error:'unexpected'},{status:500}),
  },'POST')
  const result=await POST({json:async()=>({form:{...form,email:'bad'},items:[]})})
  assert.equal(result.status,400);assert.equal(prepared,0)
})

test('changed Stripe key/account scope can never be treated as provider absence', async () => {
  const h=harness({attempt:{provider_scope:'0'.repeat(64)}})
  await assert.rejects(h.reconcile('test',{stripe:h.stripe}),/scope changed/)
  assert.equal(h.counters.releases,0)
})

test('unstarted preparation uses atomic cancellation guard without a provider lookup', async () => {
  const h=harness({attempt:{provider_started_at:null}})
  h.stripe.checkout.sessions.list=async()=>{throw Error('must not contact Stripe')}
  assert.equal((await h.reconcile('test',{stripe:h.stripe})).status,'cancelled')
  assert.equal(h.counters.releases,1)
})

test('signed expiry can release an unbound attempt but not a mismatched payment', async () => {
  let releases=0
  const session={id:'cs_lost',currency:'gbp',amount_total:2000,metadata:{orderNumber:'test'}}
  const event={type:'checkout.session.expired',data:{object:session}}
  const db={rpc:async()=>{releases++;return {}},from(table){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:
    table==='orders'?{order_number:'test',payment_method:'stripe',payment_intent_id:null,status:'pending',total_gbp:20}:
      {session_id:null,provider_scope:scope,provider_started_at:'2026-10-01'}})};return q}}
  const POST=load('app/api/stripe/webhook/route.js',{
    Stripe:class{webhooks={constructEvent:()=>event}},supabaseAdmin:db,stripeProviderScope:()=>scope,
    errorResponse:()=>Response.json({error:'retry'},{status:503}),
  },'POST')
  const req={text:async()=>'',headers:new Headers()}
  assert.equal((await POST(req)).status,200);assert.equal(releases,1)
  session.amount_total=1
  assert.equal((await POST(req)).status,503);assert.equal(releases,1)
})
