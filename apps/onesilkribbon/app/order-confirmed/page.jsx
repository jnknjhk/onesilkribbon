'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart'

function OrderConfirmedContent() {
  const params = useSearchParams()
  const orderNumber = params.get('order') || ''
  const [status, setStatus] = useState('checking')
  const query = params.toString()

  useEffect(() => {
    let active = true
    let timer
    let attempts = 0
    const controller = new AbortController()
    const check = async () => {
      try {
        const response = await fetch('/api/order-status?' + query, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!active) return
        if (!response.ok) { setStatus(response.status === 503 ? 'unavailable' : 'invalid'); return }
        setStatus(data.status)
        if (data.status === 'pending' && ++attempts < 15) timer = setTimeout(check, 2000)
      } catch { if (active) setStatus('unavailable') }
    }
    check()
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [query])

  // Clean up only the unchanged basket associated with this checkout, and only
  // after server confirmation. Never clear items added while payment was processing.
  useEffect(() => {
    if (status !== 'confirmed') return
    try {
      const saved = JSON.parse(sessionStorage.getItem('osr-checkout-basket') || 'null')
      if (!saved) return
      const stripeMatch = saved.sessionId && params.get('session_id') === saved.sessionId
      // PayPal proofs are minted only by the successful capture redirect. Preserve
      // its basket here rather than assume a proof belongs to the latest checkout.
      if (!stripeMatch) return
      if (JSON.stringify(useCart.getState().items) === JSON.stringify(saved.items)) useCart.getState().clearCart()
      sessionStorage.removeItem('osr-checkout-basket')
    } catch {}
  }, [status, query, params])

  if (status !== 'confirmed') return (
    <div style={{ padding: '160px 24px 100px', textAlign: 'center', minHeight: '70vh' }}>
      <h1>{status === 'checking' ? 'Checking your payment…' : status === 'pending' || status === 'unavailable' ? 'Payment confirmation pending' : 'Order not confirmed'}</h1>
      <p style={{ margin: '24px auto', maxWidth: 520 }}>
        {status === 'invalid' || status === 'not-confirmed'
          ? 'Please use the confirmation link from checkout or check your order in your account.'
          : 'Please do not pay again. Your basket has been kept. Refresh this page shortly or contact us if you need help.'}
      </p>
      <Link href="/account">View my account</Link>
      <p><a href="mailto:song@onesilkribbon.com">Contact support</a></p>
    </div>
  )

  return (
    <div style={{ paddingTop: 140, minHeight: '80vh', textAlign: 'center', padding: '140px 40px 100px' }}>
      {/* Animated ribbon SVG */}
      <div style={{ width: 80, height: 80, margin: '0 auto 36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <circle cx="30" cy="30" r="28" stroke="var(--gold)" strokeWidth="1"/>
          <path d="M 10 30 Q 20 15 30 30 Q 40 45 50 30" stroke="var(--gold)" strokeWidth="1.5" fill="none" style={{ animation: 'drawCheck 1s 0.3s ease forwards', strokeDasharray: 60, strokeDashoffset: 60 }}/>
        </svg>
      </div>

      <span className="eyebrow" style={{ marginBottom: 20 }}>Order Confirmed</span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,4vw,56px)', fontWeight: 300, color: 'var(--ink)', marginBottom: 16 }}>
        Thank you for your order
      </h1>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', color: 'var(--taupe)', marginBottom: 48 }}>
        Your payment has been confirmed
      </p>

      {/* Order details card */}
      <div style={{ maxWidth: 480, margin: '0 auto 48px', background: 'var(--sand)', padding: '36px 40px', textAlign: 'left' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row label="Order number" value={orderNumber} />
          <Row label="Estimated dispatch" value="Within 2 business days" />
          <Row label="Delivery" value="5–14 days after dispatch" />
          <div style={{ height: 1, background: 'var(--warm)' }} />
          <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.8 }}>
            Please check your inbox for your confirmation email. You&apos;ll receive a shipping notification with your tracking number once your order is dispatched.
          </p>
          <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 8 }}>
            Need help? <a href="mailto:song@onesilkribbon.com" style={{ color: 'var(--gold)' }}>song@onesilkribbon.com</a>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={`/track-order?order=${orderNumber}`}>
          <button className="btn-primary" style={{ width: 'auto', padding: '16px 40px' }}>
            Track My Order
          </button>
        </Link>
        <Link href="/collections">
          <button className="btn-secondary" style={{ width: 'auto', padding: '16px 40px' }}>
            Continue Shopping
          </button>
        </Link>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes drawCheck{to{stroke-dashoffset:0}}` }} />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--taupe)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--ink)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function OrderConfirmedPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: 200, textAlign: 'center' }}>Loading…</div>}>
      <OrderConfirmedContent />
    </Suspense>
  )
}
