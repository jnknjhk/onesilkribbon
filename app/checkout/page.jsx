'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart'
import { formatGBP, calculateTotals } from '@/lib/pricing'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getSubtotal, clearCart } = useCart()
  const subtotalValue = getSubtotal ? getSubtotal() : 0

  // 运费设置（从数据库读取）
  const [shippingSettings, setShippingSettings] = useState(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setShippingSettings({
          shippingRate:          parseFloat(data.shipping_rate)           || 3.95,
          freeShippingThreshold: parseFloat(data.free_shipping_threshold) || 45.00,
          freeShippingEnabled:   data.free_shipping_enabled !== 'false',
        })
      })
      .catch(() => {})
  }, [])

  const [step, setStep] = useState('details')
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('paypal')
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '',
    line1: '', line2: '', city: '', postcode: '', country: 'GB',
    phone: '',
  })
  const [errors, setErrors] = useState({})

  // 优惠码
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  if (items.length === 0) {
    return (
      <div style={{ paddingTop: 160, textAlign: 'center', minHeight: '70vh' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontStyle: 'italic', color: 'var(--taupe)', marginBottom: 32 }}>
          Your basket is empty
        </p>
        <Link href="/collections"><button className="btn-primary" style={{ width: 'auto', padding: '16px 48px' }}>Continue Shopping</button></Link>
      </div>
    )
  }

  const validate = () => {
    const e = {}
    if (!form.email.includes('@')) e.email = 'Please enter a valid email'
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim())  e.lastName = 'Required'
    if (!form.line1.trim())     e.line1 = 'Required'
    if (!form.city.trim())      e.city = 'Required'
    if (!form.postcode.trim())  e.postcode = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await fetch('/api/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, subtotal: subtotalValue }),
      })
      const data = await res.json()
      if (data.valid) { setCoupon(data); setCouponError('') }
      else setCouponError(data.error || '优惠码无效')
    } catch { setCouponError('验证失败，请重试') }
    setCouponLoading(false)
  }

  const discountAmount = coupon ? coupon.discountAmount : 0
  // 用数据库运费设置计算总额
  const totals = calculateTotals(subtotalValue - discountAmount, shippingSettings)

  const handleContinue = () => {
    if (validate()) setStep('payment')
  }

  const handleStripePayment = async () => {
    setLoading(true)
    try {
      const stripeRes = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, form, totals, coupon }),
      })
      const { url } = await stripeRes.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const handlePayPalPayment = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, form, totals, coupon }),
      })
      const { approvalUrl } = await res.json()
      if (approvalUrl) window.location.href = approvalUrl
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (paymentMethod === 'stripe') handleStripePayment()
    else handlePayPalPayment()
  }

  const f = (field, label, type = 'text', half = false) => (
    <div style={{ gridColumn: half ? 'span 1' : 'span 2' }}>
      <label className="input-label">{label}</label>
      <input
        type={type} value={form[field]} className="input"
        onChange={e => { setForm(p => ({...p, [field]: e.target.value})); setErrors(p => ({...p, [field]: ''})) }}
        style={{ borderColor: errors[field] ? '#C0392B' : undefined }}
      />
      {errors[field] && <p style={{ fontSize: 11, color: '#C0392B', marginTop: 4 }}>{errors[field]}</p>}
    </div>
  )

  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 60px 100px', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 80, alignItems: 'start' }} className="checkout-grid">

        {/* Left: Form */}
        <div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 48, borderBottom: '1px solid var(--sand)', paddingBottom: 24 }}>
            {[['details','1. Your Details'],['payment','2. Payment']].map(([id, label]) => (
              <span key={id} style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: step === id ? 'var(--ink)' : 'var(--taupe)', fontWeight: step === id ? 400 : 300, cursor: step === 'payment' && id === 'details' ? 'pointer' : 'default' }}
                onClick={() => { if (step === 'payment' && id === 'details') setStep('details') }}>
                {label}
              </span>
            ))}
          </div>

          {step === 'details' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, marginBottom: 32, color: 'var(--ink)' }}>
                Contact & Delivery
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
                {f('email', 'Email Address', 'email')}
                {f('firstName', 'First Name', 'text', true)}
                {f('lastName', 'Last Name', 'text', true)}
                {f('line1', 'Address Line 1')}
                {f('line2', 'Address Line 2 (optional)')}
                {f('city', 'City / Town', 'text', true)}
                {f('postcode', 'Postcode', 'text', true)}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Country</label>
                  <select className="input" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))}>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="NL">Netherlands</option>
                    <option value="SE">Sweden</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                  </select>
                </div>
                {f('phone', 'Phone Number (optional)', 'tel')}
              </div>
              <button className="btn-primary" onClick={handleContinue}>
                Continue to Payment
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, marginBottom: 32, color: 'var(--ink)' }}>
                Payment Method
              </h2>
              <div style={{ background: 'var(--mist)', padding: 24, marginBottom: 36, fontSize: 13, color: 'var(--deep)', lineHeight: 1.7 }}>
                <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 8 }}>Delivering to</p>
                <p><strong style={{ fontWeight: 400 }}>{form.firstName} {form.lastName}</strong></p>
                <p>{form.line1}{form.line2 ? `, ${form.line2}` : ''}, {form.city}, {form.postcode}</p>
                <p>{form.email}</p>
                <button onClick={() => setStep('details')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--gold)', letterSpacing: '0.12em', marginTop: 8, cursor: 'pointer' }}>
                  Edit details
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
                {[
                  { id: 'paypal', label: 'PayPal', sub: 'Pay with your PayPal account or card', icon: '🅿' },
                  { id: 'stripe', label: 'Pay by Card', sub: 'Visa, Mastercard, Amex, Apple Pay, Google Pay', icon: '💳' },
                ].map(opt => (
                  <label key={opt.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: 20,
                    border: `1px solid ${paymentMethod === opt.id ? 'var(--gold)' : 'var(--warm)'}`,
                    background: paymentMethod === opt.id ? 'var(--mist)' : 'transparent',
                    cursor: 'pointer', transition: 'border-color 0.3s',
                  }}>
                    <input type="radio" name="payment" value={opt.id}
                      checked={paymentMethod === opt.id}
                      onChange={() => setPaymentMethod(opt.id)}
                      style={{ accentColor: 'var(--gold)' }} />
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{opt.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--taupe)' }}>{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ background: 'var(--sand)', padding: '14px 20px', marginBottom: 28, fontSize: 12, color: 'var(--taupe)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--deep)' }}>VAT registered (GB).</span> All prices include 20% UK VAT. A VAT receipt will be emailed after purchase.
              </div>

              <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Processing…' : `Place Order · ${formatGBP(totals.total)}`}
              </button>

              <p style={{ fontSize: 11, color: 'var(--taupe)', textAlign: 'center', marginTop: 16, lineHeight: 1.8 }}>
                By placing your order you agree to our{' '}
                <Link href="/terms" style={{ color: 'var(--gold)' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" style={{ color: 'var(--gold)' }}>Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>

        {/* Right: Order Summary */}
        <div style={{ position: 'sticky', top: 120 }}>
          <div style={{ background: 'var(--sand)', padding: 36 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, marginBottom: 28, color: 'var(--ink)' }}>
              Order Summary
            </h3>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--warm)' }}>
              {items.map(item => (
                <div key={item.skuId} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 52, height: 64, background: item.colourHex || 'var(--warm)', flexShrink: 0, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -8, right: -8, background: 'var(--deep)', color: '#fff', width: 18, height: 18, borderRadius: '50%', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.qty}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4, fontFamily: 'var(--font-display)', fontWeight: 400 }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--taupe)' }}>{item.skuDesc}</p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--deep)' }}>{formatGBP(item.price * item.qty)}</p>
                </div>
              ))}
            </div>

            {/* 优惠码输入 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={couponCode}
                  onChange={e => { setCouponCode(e.target.value); setCouponError(''); setCoupon(null) }}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                  placeholder="优惠码 / Promo code"
                  style={{ flex: 1, padding: '10px 12px', background: 'var(--cream)', border: '1px solid var(--warm)', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--ink)', outline: 'none' }}
                />
                <button onClick={applyCoupon} disabled={couponLoading}
                  style={{ padding: '10px 16px', background: 'var(--ink)', border: 'none', color: '#fff', fontSize: 11, letterSpacing: '.1em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {couponLoading ? '…' : '使用'}
                </button>
              </div>
              {couponError && <p style={{ fontSize: 11, color: '#C0392B', marginTop: 6 }}>{couponError}</p>}
              {coupon && <p style={{ fontSize: 11, color: '#2E7D32', marginTop: 6 }}>✓ {coupon.description || coupon.code} 已应用</p>}
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SummaryRow label="Subtotal (exc. VAT)" value={formatGBP(totals.subtotalExVat)} />
              <SummaryRow label="VAT (20%)" value={formatGBP(totals.vatAmount)} />
              {coupon && <SummaryRow label={`Promo: ${coupon.code}`} value={`-${formatGBP(discountAmount)}`} highlight />}
              <SummaryRow label="Shipping" value={totals.freeShipping ? 'Free' : formatGBP(totals.shipping)} />
              <div style={{ height: 1, background: 'var(--warm)', margin: '8px 0' }} />
              <SummaryRow label="Total" value={formatGBP(totals.total)} bold />
            </div>

            {!totals.freeShipping && shippingSettings?.freeShippingEnabled && (
              <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--cream)', fontSize: 11, color: 'var(--taupe)' }}>
                Add {formatGBP(totals.amountToFreeShipping)} more for free shipping
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 20 }}>
            {['🔒 Secure','↩ 30-day returns','✦ VAT Receipt'].map(t => (
              <span key={t} style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '0.08em' }}>{t}</span>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : 12, color: highlight ? '#2E7D32' : bold ? 'var(--ink)' : 'var(--taupe)' }}>
      <span style={{ letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontFamily: bold ? 'var(--font-display)' : 'inherit', fontSize: bold ? 20 : 12 }}>{value}</span>
    </div>
  )
}
