const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8')
function load(source,bindings,names){return new Function(...Object.keys(bindings),source.replace(/^import .*$/gm,'').replace(/^export /gm,'')+`;return {${names}}`)(...Object.values(bindings))}
const crypto=require('node:crypto')
process.env.SUPABASE_SERVICE_KEY='unit-test-confirmation-secret'
const proofs=load(read('lib/payment-proof.js'),{...crypto},'createPaymentProof,paymentProofDetails,verifyPaymentProof,confirmationCookieName,readConfirmationCookie,checkoutReference')
const {NextResponse}=require('next/server')
const {confirmationResponse}=load(read('lib/confirmation-response.js'),{NextResponse,...proofs},'confirmationResponse')

test('normalized redirect bypasses, encoded separators and unsafe fallbacks cannot escape origin',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../../packages/core/lib/safe-next.js'),'utf8')
  const {safeNextPath}=load(source,{},'safeNextPath')
  for(const value of ['/..//example.org','/foo/../../..//example.org','//example.org','/\\example.org','/%2f%2fexample.org','/%2e%2e//example.org','/%5cexample.org','/x\n//example.org','javascript:alert(1)','https://example.org',null,{},'/invalid%']) {
    assert.equal(safeNextPath(value),'/account',String(value))
    assert.equal(new URL(safeNextPath(value),'https://onesilkribbon.com/').origin,'https://onesilkribbon.com')
  }
  assert.equal(safeNextPath(null,'//example.org'),'/account')
  for(const value of ['/account?tab=orders#top','/collections/fine-silk-ribbons','/collections?q=rose%20gold']) assert.equal(safeNextPath(value),value)
})

test('confirmation response uses scoped HttpOnly Secure cookie and clean redirect',()=>{
  const oldEnv=process.env.NODE_ENV
  process.env.NODE_ENV='production'
  try{
    const reference=proofs.checkoutReference('cs_test_long_enough_for_testing')
    const response=confirmationResponse(new Request('https://onesilkribbon.com/api/paypal/capture?token=secret'),'OSR-TEST',reference)
    assert.equal(response.status,303)
    assert.equal(response.headers.get('location'),'https://onesilkribbon.com/order-confirmed?order=OSR-TEST')
    const cookie=response.cookies.get(proofs.confirmationCookieName('OSR-TEST'))
    assert.equal(proofs.paymentProofDetails(cookie.value,'OSR-TEST').checkoutReference,reference)
    assert.match(response.headers.get('set-cookie'),/HttpOnly/)
    assert.match(response.headers.get('set-cookie'),/Secure/)
    assert.match(response.headers.get('set-cookie'),/Path=\/api\/order-status/)
    assert.match(response.headers.get('set-cookie'),/SameSite=lax/i)
    assert.equal(response.headers.get('referrer-policy'),'no-referrer')
    assert.match(response.headers.get('cache-control'),/no-store/)
  }finally{process.env.NODE_ENV=oldEnv}
})

test('legacy proof migration preserves original expiration rather than extending bearer life',()=>{
  const token=proofs.createPaymentProof('OSR-OLD')
  const response=confirmationResponse(new Request('https://onesilkribbon.com/api/payment-confirmation'),'OSR-OLD',undefined,token)
  assert.equal(response.cookies.get(proofs.confirmationCookieName('OSR-OLD')).value,token)
  assert.throws(()=>confirmationResponse(new Request('https://onesilkribbon.com/api/payment-confirmation'),'OSR-WRONG',undefined,token))
})

test('Stripe confirmation checks provider identity, amount, paid status and local binding before cookie',async()=>{
  const session={id:'cs_test_abcdefghijklmnopqrstuvwxyz',payment_intent:'pi_test',currency:'gbp',amount_total:2000,payment_status:'paid',metadata:{orderNumber:'OSR-TEST'}}
  let saved={payment_method:'stripe',payment_intent_id:session.id,total_gbp:20}
  const supabaseAdmin={from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:saved})};return q}}
  const {GET}=load(read('app/api/payment-confirmation/route.js'),{
    ...proofs,confirmationResponse,supabaseAdmin,Stripe:class{checkout={sessions:{retrieve:async()=>session}}},
  },'GET')
  const req=new Request('https://onesilkribbon.com/api/payment-confirmation?order=OSR-TEST&session_id='+session.id)
  assert.equal((await GET(req)).status,303)
  for(const mutation of [{amount_total:1},{payment_status:'unpaid'},{currency:'usd'},{metadata:{orderNumber:'OTHER'}}]){
    const original={...session};Object.assign(session,mutation)
    const response=await GET(req)
    assert.equal(response.status,400);assert.equal(response.headers.has('set-cookie'),false)
    Object.assign(session,original)
  }
  saved={...saved,payment_intent_id:'another-session'}
  assert.equal((await GET(req)).status,400)
  const legacy=new Request('https://onesilkribbon.com/api/payment-confirmation?order=OSR-OLD&proof='+proofs.createPaymentProof('OSR-OLD'))
  assert.equal((await GET(legacy)).status,303)
})

test('PayPal callback issues proof only after successful recovery and never puts it in Location',async()=>{
  let fail=false
  const {GET}=load(read('app/api/paypal/capture/route.js'),{
    confirmationResponse,recoverPayPal:async()=>{if(fail)throw Error('pending')},
    errorResponse:()=>Response.json({error:'retry'},{status:503}),
  },'GET')
  const req=new Request('https://onesilkribbon.com/api/paypal/capture?token=PP-TEST&order=OSR-TEST')
  const result=await GET(req)
  assert.equal(result.status,303);assert.doesNotMatch(result.headers.get('location'),/proof|token|PP-TEST/)
  fail=true
  assert.equal((await GET(req)).status,503)
})

test('Stripe outages show retry guidance without issuing a cookie or falsely rejecting a payment',async()=>{
  const {GET}=load(read('app/api/payment-confirmation/route.js'),{
    ...proofs,confirmationResponse,Stripe:class{checkout={sessions:{retrieve:async()=>{throw Error('provider timeout')}}}},
  },'GET')
  const response=await GET(new Request('https://onesilkribbon.com/api/payment-confirmation?order=OSR-TEST&session_id=cs_test_abcdefghijklmnopqrstuvwxyz'))
  assert.equal(response.status,503)
  assert.equal(response.headers.has('set-cookie'),false)
  const html=await response.text()
  assert.match(html,/do not pay again/)
  assert.match(html,/Retry confirmation/)
  assert.doesNotMatch(html,/cs_test_|proof=/)
})

test('status requires the matching cookie; URL credentials alone are rejected',async()=>{
  const order={status:'paid',payment_method:'paypal'}
  const supabaseAdmin={from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:order})};return q}}
  const {GET}=load(read('app/api/order-status/route.js'),{...proofs,supabaseAdmin},'GET')
  const token=proofs.createPaymentProof('OSR-TEST')
  const url='https://onesilkribbon.com/api/order-status?order=OSR-TEST'
  assert.equal((await GET(new Request(url+'&proof='+token))).status,400)
  const response=await GET(new Request(url,{headers:{cookie:proofs.confirmationCookieName('OSR-TEST')+'='+token}}))
  assert.deepEqual(await response.json(),{status:'confirmed'})
  const wrongCookie=proofs.confirmationCookieName('OSR-TEST')+'='+proofs.createPaymentProof('OTHER')
  assert.equal((await GET(new Request(url,{headers:{cookie:wrongCookie}}))).status,400)
})

test('tracking uses POST, validates input and never accepts an email URL lookup',async()=>{
  let reads=0
  const supabaseAdmin={from(){reads++;const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{order_number:'OSR-TEST',customer_email:'buyer@example.org',status:'paid',shipping_name:'Test Buyer',created_at:'2026-01-01',shipping_city:'London',shipping_country:'GB'}})};return q}}
  const {GET,POST}=load(read('app/api/tracking/route.js'),{supabaseAdmin},'GET,POST')
  assert.equal((await GET(new Request('https://example.org/api/tracking?order=OSR-TEST&email=buyer@example.org'))).status,405)
  assert.equal(reads,0)
  assert.equal((await POST({json:async()=>({order:[],email:{}})})).status,400)
  const response=await POST({json:async()=>({order:'OSR-TEST',email:'buyer@example.org'})})
  assert.equal(response.status,200)
  assert.match(response.headers.get('cache-control'),/no-store/)
  assert.doesNotMatch(JSON.stringify(await response.json()),/buyer@example.org/)
  assert.equal((await POST({json:async()=>({order:'OSR-TEST',email:'wrong@example.org'})})).status,404)
  assert.match(read('app/track-order/page.jsx'),/method:'POST'/)
  assert.doesNotMatch(read('app/track-order/page.jsx'),/api\/tracking\?order=/)
})
