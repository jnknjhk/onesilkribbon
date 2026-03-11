'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart'
import { formatGBP, calculateTotals } from '@/lib/pricing'

// ─── Country Data ────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code:'GB', name:'United Kingdom',  dialCode:'+44',  continent:'Popular',      postcodeReg:/^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i, postcodeTip:'SW1A 2AA',   phoneReg:/^[0-9]{10,11}$/, noPostcode:false },
  { code:'US', name:'United States',   dialCode:'+1',   continent:'Popular',      postcodeReg:/^[0-9]{5}(-[0-9]{4})?$/,                       postcodeTip:'10001',      phoneReg:/^[0-9]{10}$/,    noPostcode:false },
  { code:'CA', name:'Canada',          dialCode:'+1',   continent:'Popular',      postcodeReg:/^[A-Z][0-9][A-Z]\s*[0-9][A-Z][0-9]$/i,         postcodeTip:'K1A 0B1',    phoneReg:/^[0-9]{10}$/,    noPostcode:false },
  { code:'AU', name:'Australia',       dialCode:'+61',  continent:'Popular',      postcodeReg:/^[0-9]{4}$/,                                   postcodeTip:'2000',       phoneReg:/^[0-9]{9,10}$/,  noPostcode:false },
  { code:'DE', name:'Germany',         dialCode:'+49',  continent:'Europe',       postcodeReg:/^[0-9]{5}$/,                                   postcodeTip:'10115',      phoneReg:/^[0-9]{10,11}$/, noPostcode:false },
  { code:'FR', name:'France',          dialCode:'+33',  continent:'Europe',       postcodeReg:/^[0-9]{5}$/,                                   postcodeTip:'75001',      phoneReg:/^[0-9]{9,10}$/,  noPostcode:false },
  { code:'NL', name:'Netherlands',     dialCode:'+31',  continent:'Europe',       postcodeReg:/^[0-9]{4}\s*[A-Z]{2}$/i,                       postcodeTip:'1011 AB',    phoneReg:/^[0-9]{9,10}$/,  noPostcode:false },
  { code:'IT', name:'Italy',           dialCode:'+39',  continent:'Europe',       postcodeReg:/^[0-9]{5}$/,                                   postcodeTip:'00118',      phoneReg:/^[0-9]{9,11}$/,  noPostcode:false },
  { code:'ES', name:'Spain',           dialCode:'+34',  continent:'Europe',       postcodeReg:/^[0-9]{5}$/,                                   postcodeTip:'28001',      phoneReg:/^[0-9]{9}$/,     noPostcode:false },
  { code:'SE', name:'Sweden',          dialCode:'+46',  continent:'Europe',       postcodeReg:/^[0-9]{3}\s*[0-9]{2}$/,                        postcodeTip:'111 22',     phoneReg:/^[0-9]{9,10}$/,  noPostcode:false },
  { code:'BE', name:'Belgium',         dialCode:'+32',  continent:'Europe',       postcodeReg:/^[0-9]{4}$/,                                   postcodeTip:'1000',       phoneReg:/^[0-9]{8,10}$/,  noPostcode:false },
  { code:'AT', name:'Austria',         dialCode:'+43',  continent:'Europe',       postcodeReg:/^[0-9]{4}$/,                                   postcodeTip:'1010',       phoneReg:/^[0-9]{7,13}$/,  noPostcode:false },
  { code:'DK', name:'Denmark',         dialCode:'+45',  continent:'Europe',       postcodeReg:/^[0-9]{4}$/,                                   postcodeTip:'1050',       phoneReg:/^[0-9]{8}$/,     noPostcode:false },
  { code:'IE', name:'Ireland',         dialCode:'+353', continent:'Europe',       postcodeReg:/^[A-Z][0-9]{2}\s*[A-Z0-9]{4}$/i,               postcodeTip:'D01 F5P2',   phoneReg:/^[0-9]{9,10}$/,  noPostcode:false },
  { code:'CH', name:'Switzerland',     dialCode:'+41',  continent:'Europe',       postcodeReg:/^[0-9]{4}$/,                                   postcodeTip:'8001',       phoneReg:/^[0-9]{9,10}$/,  noPostcode:false },
  { code:'CN', name:'China',           dialCode:'+86',  continent:'Asia Pacific', postcodeReg:/^[0-9]{6}$/,                                   postcodeTip:'100000',     phoneReg:/^1[3-9][0-9]{9}$/,noPostcode:false },
  { code:'HK', name:'Hong Kong',       dialCode:'+852', continent:'Asia Pacific', postcodeReg:/^.*$/,                                         postcodeTip:'(none)',     phoneReg:/^[0-9]{8}$/,     noPostcode:true  },
  { code:'JP', name:'Japan',           dialCode:'+81',  continent:'Asia Pacific', postcodeReg:/^[0-9]{3}-[0-9]{4}$/,                          postcodeTip:'100-0001',   phoneReg:/^0[0-9]{9,10}$/, noPostcode:false },
  { code:'SG', name:'Singapore',       dialCode:'+65',  continent:'Asia Pacific', postcodeReg:/^[0-9]{6}$/,                                   postcodeTip:'018956',     phoneReg:/^[0-9]{8}$/,     noPostcode:false },
  { code:'AE', name:'UAE',             dialCode:'+971', continent:'Middle East',  postcodeReg:/^.*$/,                                         postcodeTip:'(none)',     phoneReg:/^0[0-9]{8,9}$/,  noPostcode:true  },
]
const CONTINENTS = ['Popular','Europe','Asia Pacific','Middle East']
const getCountry = code => COUNTRIES.find(c => c.code === code) || COUNTRIES[0]
const DIAL_CODES = [...new Map(COUNTRIES.map(c => [c.dialCode, c])).values()]
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

function Field({ id, label, type='text', half=false, autoComplete, value, error, touch, onChange, onBlur }) {
  return (
    <div style={{ gridColumn: half ? 'span 1' : 'span 2' }}>
      <label className="input-label">{label}</label>
      <input type={type} value={value} autoComplete={autoComplete} placeholder="" className="input"
        onChange={e => onChange(id, e.target.value)} onBlur={() => onBlur(id)}
        style={{ borderColor: error ? '#C0392B' : touch && !error ? '#5a8a5a' : undefined }} />
      {error && <p style={{ fontSize:11, color:'#C0392B', marginTop:4 }}>{error}</p>}
      {!error && touch && <p style={{ fontSize:11, color:'#5a8a5a', marginTop:4 }}>✓</p>}
    </div>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getSubtotal, clearCart } = useCart()
  const subtotalValue = getSubtotal ? getSubtotal() : 0

  const [shippingSettings, setShippingSettings] = useState(null)
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setShippingSettings({
        shippingRate:          parseFloat(data.shipping_rate)           || 0,
        freeShippingThreshold: parseFloat(data.free_shipping_threshold) || 45,
        freeShippingEnabled:   data.free_shipping_enabled !== 'false',
      })
    }).catch(() => {})
  }, [])

  const [step, setStep] = useState('details')
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('paypal')

  const [form, setForm] = useState({
    email:'', firstName:'', lastName:'',
    line1:'', line2:'', city:'', postcode:'', country:'GB',
    dialCode:'+44', phone:'',
  })
  const [touched, setTouched] = useState({})
  const [errors, setErrors] = useState({})

  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  if (items.length === 0) {
    return (
      <div style={{ paddingTop:160, textAlign:'center', minHeight:'70vh' }}>
        <p style={{ fontFamily:'var(--font-display)', fontSize:32, fontStyle:'italic', color:'var(--taupe)', marginBottom:32 }}>Your basket is empty</p>
        <Link href="/collections">
          <button className="btn-primary" style={{ width:'auto', padding:'16px 48px' }}>Continue Shopping</button>
        </Link>
      </div>
    )
  }

  const handleCountryChange = code => {
    const c = getCountry(code)
    setForm(p => ({ ...p, country:code, dialCode:c.dialCode, postcode:'' }))
    setErrors(p => ({ ...p, postcode:'', phone:'' }))
  }
  const handleChange = (field, value) => {
    let v = value
    if (field === 'postcode') { const c = getCountry(form.country); if (['GB','IE'].includes(c.code)) v = value.toUpperCase() }
    setForm(p => ({ ...p, [field]: v }))
  }
  const handleBlur = (field) => { setTouched(p => ({ ...p, [field]: true })); validateField(field, form[field]) }

  const validateField = (field, value) => {
    const c = getCountry(form.country)
    let err = ''
    if (field === 'email') { if (!value.trim()) err = 'Email is required'; else if (!validEmail(value)) err = 'Please enter a valid email address' }
    if (field === 'firstName' && !value.trim()) err = 'Required'
    if (field === 'lastName' && !value.trim()) err = 'Required'
    if (field === 'line1' && !value.trim()) err = 'Required'
    if (field === 'city' && !value.trim()) err = 'Required'
    if (field === 'postcode') {
      if (c.noPostcode) err = ''
      else if (!value.trim()) err = 'Required'
      else if (!c.postcodeReg.test(value.trim())) err = `Invalid postcode — e.g. ${c.postcodeTip}`
    }
    if (field === 'phone') { if (!value.trim()) err = 'Phone number is required'; else if (!c.phoneReg.test(value.trim().replace(/\s/g,''))) err = 'Invalid phone number' }
    setErrors(p => ({ ...p, [field]: err }))
    return !err
  }
  const validate = () => {
    const fields = ['email','firstName','lastName','line1','city','postcode','phone']
    setTouched(Object.fromEntries(fields.map(f => [f, true])))
    return fields.map(f => validateField(f, form[f])).every(Boolean)
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true); setCouponError('')
    try {
      const res = await fetch('/api/coupon', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code:couponCode, subtotal:subtotalValue }) })
      const data = await res.json()
      if (data.valid) { setCoupon(data); setCouponError('') }
      else setCouponError(data.error || 'Invalid promo code')
    } catch { setCouponError('Could not verify code') }
    setCouponLoading(false)
  }

  const discountAmount = coupon ? coupon.discountAmount : 0
  const totals = calculateTotals(subtotalValue - discountAmount, shippingSettings)

  const handleContinue = () => { if (validate()) setStep('payment') }

  const handlePayPalPayment = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/paypal/create-order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items, form, totals, coupon }) })
      const { approvalUrl } = await res.json()
      if (approvalUrl) window.location.href = approvalUrl
    } catch (err) { console.error(err); setLoading(false) }
  }

  const handleStripePayment = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items, form, totals, coupon }) })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) { console.error(err); setLoading(false) }
  }

  const handleSubmit = () => {
    if (paymentMethod === 'stripe') handleStripePayment()
    else handlePayPalPayment()
  }

  const country = getCountry(form.country)

  return (
    <div style={{ paddingTop:100, background:'var(--cream)', minHeight:'100vh' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'40px 60px 100px', display:'grid', gridTemplateColumns:'1fr 400px', gap:80, alignItems:'start' }} className="checkout-grid">

        {/* Left */}
        <div>
          <div style={{ display:'flex', gap:32, marginBottom:48, borderBottom:'1px solid var(--sand)', paddingBottom:24 }}>
            {[['details','1. Your Details'],['payment','2. Payment']].map(([id, label]) => (
              <span key={id} onClick={() => { if (step==='payment' && id==='details') setStep('details') }}
                style={{ fontSize:11, letterSpacing:'0.2em', textTransform:'uppercase', color: step===id ? 'var(--ink)' : 'var(--taupe)', cursor: step==='payment' && id==='details' ? 'pointer' : 'default' }}>
                {label}
              </span>
            ))}
          </div>

          {step === 'details' && (
            <>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:300, marginBottom:32, color:'var(--ink)' }}>Contact & Delivery</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:40 }}>
                <Field id="email" label="Email Address" type="email" autoComplete="email" value={form.email} error={errors.email} touch={touched.email} onChange={handleChange} onBlur={handleBlur} />
                <Field id="firstName" label="First Name" half autoComplete="given-name" value={form.firstName} error={errors.firstName} touch={touched.firstName} onChange={handleChange} onBlur={handleBlur} />
                <Field id="lastName" label="Last Name" half autoComplete="family-name" value={form.lastName} error={errors.lastName} touch={touched.lastName} onChange={handleChange} onBlur={handleBlur} />
                <Field id="line1" label="Address Line 1" autoComplete="address-line1" value={form.line1} error={errors.line1} touch={touched.line1} onChange={handleChange} onBlur={handleBlur} />
                <Field id="line2" label="Address Line 2 (optional)" autoComplete="address-line2" value={form.line2} error={errors.line2} touch={touched.line2} onChange={handleChange} onBlur={handleBlur} />
                <Field id="city" label="City / Town" half autoComplete="address-level2" value={form.city} error={errors.city} touch={touched.city} onChange={handleChange} onBlur={handleBlur} />

                <div style={{ gridColumn:'span 1' }}>
                  <label className="input-label">{country.noPostcode ? 'Postcode (not required)' : `Postcode — e.g. ${country.postcodeTip}`}</label>
                  <input type="text" value={form.postcode} className="input" disabled={country.noPostcode}
                    placeholder={country.noPostcode ? 'N/A' : country.postcodeTip}
                    onChange={e => handleChange('postcode', e.target.value)} onBlur={() => handleBlur('postcode')}
                    style={{ borderColor: errors.postcode ? '#C0392B' : touched.postcode && !errors.postcode ? '#5a8a5a' : undefined, opacity: country.noPostcode ? 0.5 : 1 }} />
                  {errors.postcode && <p style={{ fontSize:11, color:'#C0392B', marginTop:4 }}>{errors.postcode}</p>}
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label className="input-label">Country</label>
                  <select className="input" value={form.country} onChange={e => handleCountryChange(e.target.value)}>
                    {CONTINENTS.map(cont => (
                      <optgroup key={cont} label={cont}>
                        {COUNTRIES.filter(c => c.continent === cont).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label className="input-label">Phone Number</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <select value={form.dialCode} onChange={e => setForm(p => ({ ...p, dialCode:e.target.value }))}
                      style={{ width:120, padding:'12px 10px', background:'var(--cream)', border:'1px solid var(--warm)', fontFamily:'var(--font-body)', fontSize:13, color:'var(--ink)', outline:'none', flexShrink:0 }}>
                      {DIAL_CODES.map(c => <option key={c.dialCode} value={c.dialCode}>{c.dialCode} {c.name}</option>)}
                    </select>
                    <div style={{ flex:1 }}>
                      <input type="tel" value={form.phone} className="input" placeholder="e.g. 07700900123" autoComplete="tel-national"
                        onChange={e => handleChange('phone', e.target.value)} onBlur={() => handleBlur('phone')}
                        style={{ borderColor: errors.phone ? '#C0392B' : touched.phone && !errors.phone ? '#5a8a5a' : undefined }} />
                      {errors.phone && <p style={{ fontSize:11, color:'#C0392B', marginTop:4 }}>{errors.phone}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <button className="btn-primary" onClick={handleContinue}>Continue to Payment</button>
            </>
          )}

          {step === 'payment' && (
            <>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:300, marginBottom:32, color:'var(--ink)' }}>Payment Method</h2>
              <div style={{ background:'var(--mist)', padding:24, marginBottom:36, fontSize:13, color:'var(--deep)', lineHeight:1.7 }}>
                <p style={{ fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--taupe)', marginBottom:8 }}>Delivering to</p>
                <p><strong style={{ fontWeight:400 }}>{form.firstName} {form.lastName}</strong></p>
                <p>{form.line1}{form.line2 ? `, ${form.line2}` : ''}, {form.city}{form.postcode ? `, ${form.postcode}` : ''}</p>
                <p>{country.name}</p>
                <p>{form.email} · {form.dialCode} {form.phone}</p>
                <button onClick={() => setStep('details')} style={{ background:'none', border:'none', fontSize:11, color:'var(--gold)', letterSpacing:'0.12em', marginTop:8, cursor:'pointer' }}>Edit details</button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:36 }}>
                {[
                  { id:'paypal', label:'PayPal', sub:'Pay with your PayPal account or card', icon:'🅿' },
                  { id:'stripe', label:'Pay by Card', sub:'Visa, Mastercard, Amex, Apple Pay, Google Pay', icon:'💳' },
                ].map(opt => (
                  <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:16, padding:20, border:`1px solid ${paymentMethod===opt.id ? 'var(--gold)' : 'var(--warm)'}`, background: paymentMethod===opt.id ? 'var(--mist)' : 'transparent', cursor:'pointer' }}>
                    <input type="radio" name="payment" value={opt.id} checked={paymentMethod===opt.id} onChange={() => setPaymentMethod(opt.id)} style={{ accentColor:'var(--gold)' }} />
                    <span style={{ fontSize:20 }}>{opt.icon}</span>
                    <div>
                      <p style={{ fontSize:13, color:'var(--ink)', marginBottom:3 }}>{opt.label}</p>
                      <p style={{ fontSize:11, color:'var(--taupe)' }}>{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Processing…' : `Place Order · ${formatGBP(totals.total)}`}
              </button>
              <p style={{ fontSize:11, color:'var(--taupe)', textAlign:'center', marginTop:16, lineHeight:1.8 }}>
                By placing your order you agree to our{' '}
                <Link href="/terms" style={{ color:'var(--gold)' }}>Terms of Service</Link>{' '}and{' '}
                <Link href="/privacy" style={{ color:'var(--gold)' }}>Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>

        {/* Right: Order Summary */}
        <div style={{ position:'sticky', top:120 }}>
          <div style={{ background:'var(--sand)', padding:36 }}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:300, marginBottom:28, color:'var(--ink)' }}>Order Summary</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:28, paddingBottom:28, borderBottom:'1px solid var(--warm)' }}>
              {items.map(item => (
                <div key={item.skuId} style={{ display:'flex', gap:14 }}>
                  <div style={{ width:52, height:52, background: item.colourHex || 'var(--warm)', flexShrink:0, position:'relative', overflow:'hidden' }}>
                    {item.image && <img src={item.image} style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                    <span style={{ position:'absolute', top:-6, right:-6, background:'var(--deep)', color:'#fff', width:18, height:18, borderRadius:'50%', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>{item.qty}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, color:'var(--ink)', marginBottom:4, fontFamily:'var(--font-display)', fontWeight:400 }}>{item.name}</p>
                    <p style={{ fontSize:11, color:'var(--taupe)' }}>{item.skuDesc}</p>
                  </div>
                  <p style={{ fontFamily:'var(--font-display)', fontSize:16, color:'var(--deep)' }}>{formatGBP(item.price * item.qty)}</p>
                </div>
              ))}
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', gap:8 }}>
                <input value={couponCode}
                  onChange={e => { setCouponCode(e.target.value); setCouponError(''); setCoupon(null) }}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                  placeholder="Promo code"
                  style={{ flex:1, padding:'10px 12px', background:'var(--cream)', border:'1px solid var(--warm)', fontSize:12, fontFamily:'var(--font-body)', color:'var(--ink)', outline:'none' }} />
                <button onClick={applyCoupon} disabled={couponLoading}
                  style={{ padding:'10px 16px', background:'var(--ink)', border:'none', color:'#fff', fontSize:11, letterSpacing:'.1em', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {couponLoading ? '…' : 'Apply'}
                </button>
              </div>
              {couponError && <p style={{ fontSize:11, color:'#C0392B', marginTop:6 }}>{couponError}</p>}
              {coupon && <p style={{ fontSize:11, color:'#2E7D32', marginTop:6 }}>✓ {coupon.description || coupon.code} applied</p>}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <SummaryRow label="Subtotal (tax included)" value={formatGBP(totals.subtotal)} />
              {coupon && <SummaryRow label={`Promo: ${coupon.code}`} value={`-${formatGBP(discountAmount)}`} highlight />}
              <SummaryRow label="Shipping" value={totals.freeShipping ? 'Free' : formatGBP(totals.shipping)} />
              <div style={{ height:1, background:'var(--warm)', margin:'8px 0' }} />
              <SummaryRow label="Total" value={formatGBP(totals.total)} bold />
            </div>

            {!totals.freeShipping && shippingSettings?.freeShippingEnabled && (
              <div style={{ marginTop:20, padding:'12px 16px', background:'var(--cream)', fontSize:11, color:'var(--taupe)' }}>
                Add {formatGBP(totals.amountToFreeShipping)} more for free shipping
              </div>
            )}
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:32, marginTop:20 }}>
            {['🔒 Secure','↩ 30-day returns'].map(t => (
              <span key={t} style={{ fontSize:10, color:'var(--taupe)', letterSpacing:'0.08em' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media(max-width:960px){ .checkout-grid{grid-template-columns:1fr !important;gap:40px !important} }
        @media(max-width:600px){ .checkout-grid{padding:24px 24px 80px !important} }
      `}</style>
    </div>
  )
}

function SummaryRow({ label, value, bold, highlight }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize: bold ? 14 : 12, color: highlight ? '#2E7D32' : bold ? 'var(--ink)' : 'var(--taupe)' }}>
      <span style={{ letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontFamily: bold ? 'var(--font-display)' : 'inherit', fontSize: bold ? 20 : 12 }}>{value}</span>
    </div>
  )
}
