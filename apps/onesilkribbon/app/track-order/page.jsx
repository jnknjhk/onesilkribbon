'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const STATUS_STEPS = ['Order Placed', 'Processing', 'Dispatched', 'In Transit', 'Delivered']

function TrackOrderContent() {
  const params = useSearchParams()
  const [orderNum, setOrderNum] = useState(params.get('order') || '')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const resultRef = useRef(null)

  useEffect(() => {
    if (!result) return
    resultRef.current?.focus({ preventScroll: true })
    resultRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [result])

  const handleTrack = async (e) => {
    e.preventDefault()
    if (!orderNum.trim() || !email.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      // 订单号是可猜的，所以查询必须带上下单邮箱——接口那边会两个一起校验
      const res = await fetch(
        '/api/tracking', {method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({order:orderNum.trim(),email:email.trim()}),cache:'no-store'}
      )
      if (!res.ok) { setError('Order not found. Please check your order number and email address.'); setLoading(false); return }
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Unable to fetch tracking information. Please try again.')
    }
    setLoading(false)
  }


  return (
    <div className="tracking-page" style={{ paddingTop: 120, minHeight: '80vh', background: 'var(--cream)' }}>
      <div className="tracking-content" style={{ maxWidth: 640, margin: '0 auto', padding: '40px 40px 100px' }}>

        {/* Header */}
        <div className="tracking-header" style={{ textAlign: 'center', marginBottom: 60 }}>
          <span className="eyebrow" style={{ marginBottom: 20 }}>One Silk Ribbon</span>
          <h1 className="display-title" style={{ marginBottom: 16 }}>Track Your <em>Order</em></h1>
          <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--taupe)', lineHeight: 1.9 }}>
            Enter your order number and the email address you used at checkout
            to see the latest shipping status. Both can be found in your confirmation email.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleTrack} aria-label="Track your order" aria-busy={loading} style={{ marginBottom: 48 }}>
          <label htmlFor="tracking-order" className="input-label">Order number</label>
          <input
            id="tracking-order" name="order" className="input" value={orderNum} required maxLength={100} autoCapitalize="characters" spellCheck={false}
            onChange={e => setOrderNum(e.target.value)}
            placeholder="e.g. OSR-2026-0001"
            style={{ width: '100%', marginBottom: 12 }}
          />
          <label htmlFor="tracking-email" className="input-label">Email address used at checkout</label>
          <div className="tracking-search" style={{ display: 'flex', gap: 0 }}>
            <input
              id="tracking-email" name="email" className="input" type="email" value={email} autoComplete="email" required maxLength={254}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ flex: 1, borderRight: 'none', minWidth: 0 }}
            />
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 32px', whiteSpace: 'nowrap' }} disabled={loading}>
              {loading ? '…' : 'Track'}
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '16px 20px', marginBottom: 32, fontSize: 13, color: '#991B1B' }}>
            {error}
          </div>
        )}

        {result && (() => {
          const d = result
          return (
            <div ref={resultRef} className="tracking-result" role="region" aria-label="Order tracking result" tabIndex={-1}>
              {/* Order header */}
              <div style={{ background: 'var(--sand)', padding: '24px 28px', marginBottom: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 6 }}>Order {d.orderNumber}</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>{d.status}</p>
                  </div>
                  <div className="tracking-carrier" style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'var(--taupe)', marginBottom: 4 }}>{d.carrier} · {d.trackingNumber}</p>
                    <p style={{ fontSize: 11, color: 'var(--taupe)' }}>Est. delivery: <strong style={{ color: 'var(--deep)', fontWeight: 400 }}>{d.estimatedDelivery}</strong></p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ background: 'var(--mist)', padding: '28px', marginBottom: 2 }}>
                <ol className="tracking-steps" aria-label="Delivery progress">
                  {STATUS_STEPS.map((s, i) => (
                    <li key={s} aria-current={i === d.statusStep ? 'step' : undefined} style={{ color: i <= d.statusStep ? 'var(--deep)' : 'var(--taupe)' }}>
                      <span className="tracking-dot" aria-hidden="true" style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: i <= d.statusStep ? 'var(--gold)' : 'var(--warm)',
                        border: i === d.statusStep ? '3px solid var(--cream)' : 'none',
                        boxShadow: i === d.statusStep ? '0 0 0 2px var(--gold)' : 'none',
                        transition: 'background 0.5s',
                      }} />
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
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
          <p style={{ fontSize: 14, fontWeight: 400, color: 'var(--taupe)', lineHeight: 1.9 }}>
            Can&apos;t find your order? <a href="mailto:orders@onesilkribbon.com" style={{ color: 'var(--gold)' }}>Contact us</a> and we&apos;ll help you track it down.
          </p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .tracking-result { overflow-wrap: anywhere; scroll-margin-top: 92px; }
        .tracking-result > div { min-width: 0; }
        .tracking-steps { list-style: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
        .tracking-steps li { display: flex; flex-direction: column; align-items: center; gap: 16px; font-size: 10px; text-align: center; }
        .tracking-dot { flex-shrink: 0; }
        @media (max-width: 600px) {
          .tracking-page { padding-top: 68px !important; }
          .tracking-content { padding: 40px 20px 64px !important; }
          .tracking-header { margin-bottom: 32px !important; }
          .tracking-search { flex-direction: column; gap: 12px !important; }
          .tracking-search input { flex: auto !important; border-right: 1px solid var(--warm) !important; }
          .tracking-search button { width: 100% !important; min-height: 48px; }
          .tracking-carrier { text-align: left !important; }
          .tracking-steps { grid-template-columns: minmax(0, 1fr); gap: 20px; }
          .tracking-steps li { flex-direction: row; gap: 16px; text-align: left; font-size: 13px; }
        }
      ` }} />
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
