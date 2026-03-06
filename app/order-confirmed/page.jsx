'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart'

function OrderConfirmedContent() {
  const params = useSearchParams()
  const orderNumber = params.get('order') || 'OSR-2026-0001'
  const { clearCart } = useCart()

  useEffect(() => { clearCart() }, [])

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
        Your silk ribbons are on their way
      </p>

      {/* Order details card */}
      <div style={{ maxWidth: 480, margin: '0 auto 48px', background: 'var(--sand)', padding: '36px 40px', textAlign: 'left' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row label="Order number" value={orderNumber} />
          <Row label="Estimated dispatch" value="Within 2 business days" />
          <Row label="Delivery" value="3–5 working days (UK Standard)" />
          <div style={{ height: 1, background: 'var(--warm)' }} />
          <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.8 }}>
            A confirmation email has been sent to your inbox. You'll receive a shipping notification with your tracking number once your order is dispatched.
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

      <style>{`@keyframes drawCheck{to{stroke-dashoffset:0}}`}</style>
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
