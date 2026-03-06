'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const STATUS_STEPS = ['Order Placed', 'Processing', 'Dispatched', 'In Transit', 'Delivered']

function TrackOrderContent() {
  const params = useSearchParams()
  const [orderNum, setOrderNum] = useState(params.get('order') || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTrack = async (e) => {
    e.preventDefault()
    if (!orderNum.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch(`/api/tracking?order=${encodeURIComponent(orderNum.trim())}`)
      if (!res.ok) { setError('Order not found. Please check your order number.'); setLoading(false); return }
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Unable to fetch tracking information. Please try again.')
    }
    setLoading(false)
  }

  // Sample result for demo
  const demo = {
    orderNumber: 'OSR-2026-0001',
    status: 'In Transit',
    statusStep: 3,
    carrier: 'Royal Mail',
    trackingNumber: 'JD000000000GB',
    estimatedDelivery: '14 March 2026',
    events: [
      { date: '12 Mar 2026, 09:14', location: 'Shenzhen, CN', message: 'Shipment collected by carrier' },
      { date: '12 Mar 2026, 23:40', location: 'Hong Kong Hub', message: 'Departed international facility' },
      { date: '13 Mar 2026, 14:22', location: 'London Heathrow, UK', message: 'Arrived in destination country' },
      { date: '13 Mar 2026, 18:05', location: 'Royal Mail, UK', message: 'In transit to delivery office' },
    ],
  }

  return (
    <div style={{ paddingTop: 120, minHeight: '80vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 40px 100px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <span className="eyebrow" style={{ marginBottom: 20 }}>One Silk Ribbon</span>
          <h1 className="display-title" style={{ marginBottom: 16 }}>Track Your <em>Order</em></h1>
          <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 1.9 }}>
            Enter your order number to see the latest shipping status.
            Your order number can be found in your confirmation email (e.g. OSR-2026-0001).
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleTrack} style={{ display: 'flex', gap: 0, marginBottom: 48 }}>
          <input
            className="input" value={orderNum}
            onChange={e => setOrderNum(e.target.value)}
            placeholder="Your order number (e.g. OSR-2026-0001)"
            style={{ flex: 1, borderRight: 'none' }}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 32px', whiteSpace: 'nowrap' }} disabled={loading}>
            {loading ? '…' : 'Track'}
          </button>
        </form>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '16px 20px', marginBottom: 32, fontSize: 13, color: '#991B1B' }}>
            {error}
          </div>
        )}

        {/* Demo result */}
        {(result || orderNum === 'OSR-2026-0001') && (() => {
          const d = result || demo
          return (
            <div>
              {/* Order header */}
              <div style={{ background: 'var(--sand)', padding: '24px 28px', marginBottom: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 6 }}>Order {d.orderNumber}</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>{d.status}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'var(--taupe)', marginBottom: 4 }}>{d.carrier} · {d.trackingNumber}</p>
                    <p style={{ fontSize: 11, color: 'var(--taupe)' }}>Est. delivery: <strong style={{ color: 'var(--deep)', fontWeight: 400 }}>{d.estimatedDelivery}</strong></p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ background: 'var(--mist)', padding: '28px', marginBottom: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 16 }}>
                  <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 1, background: 'var(--warm)' }} />
                  <div style={{ position: 'absolute', top: 6, left: 0, height: 1, background: 'var(--gold)', width: `${(d.statusStep / (STATUS_STEPS.length - 1)) * 100}%`, transition: 'width 1s ease' }} />
                  {STATUS_STEPS.map((s, i) => (
                    <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: i <= d.statusStep ? 'var(--gold)' : 'var(--warm)',
                        border: i === d.statusStep ? '3px solid var(--cream)' : 'none',
                        boxShadow: i === d.statusStep ? '0 0 0 2px var(--gold)' : 'none',
                        transition: 'background 0.5s',
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {STATUS_STEPS.map((s, i) => (
                    <span key={s} style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: i <= d.statusStep ? 'var(--gold)' : 'var(--taupe)', textAlign: 'center', flex: 1 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Events timeline */}
              <div style={{ background: 'var(--sand)', padding: '24px 28px' }}>
                <p className="eyebrow" style={{ marginBottom: 24 }}>Shipping History</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {d.events.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 20, paddingBottom: i < d.events.length - 1 ? 24 : 0, position: 'relative' }}>
                      {/* Timeline line */}
                      {i < d.events.length - 1 && (
                        <div style={{ position: 'absolute', left: 5, top: 12, bottom: 0, width: 1, background: 'var(--warm)' }} />
                      )}
                      <div style={{ width: 11, height: 11, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--warm)', flexShrink: 0, marginTop: 3, zIndex: 1 }} />
                      <div>
                        <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4, fontWeight: 400 }}>{ev.message}</p>
                        <p style={{ fontSize: 11, color: 'var(--taupe)' }}>{ev.location} · {ev.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Help */}
        <div style={{ marginTop: 48, textAlign: 'center', padding: '28px', background: 'var(--mist)', borderTop: '1px solid var(--sand)' }}>
          <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.9 }}>
            Can't find your order? <a href="mailto:orders@onesilkribbon.com" style={{ color: 'var(--gold)' }}>Contact us</a> and we'll help you track it down.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: 200, textAlign: 'center' }}>Loading…</div>}>
      <TrackOrderContent />
    </Suspense>
  )
}
