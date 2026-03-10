'use client'
import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const COUPON_CODE = 'WELCOME10'
const STORAGE_KEY = 'osr_popup'

export default function WelcomePopup() {
  const [show, setShow]           = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const pathname                  = usePathname()

  useEffect(() => {
    // 只在首页显示
    if (pathname !== '/') return

    // 检查是否已下单（localStorage标记）
    const status = localStorage.getItem(STORAGE_KEY)
    if (status === 'purchased') return

    // 检查是否从内部跳转（sessionStorage标记）
    const fromInternal = sessionStorage.getItem('osr_internal')
    if (fromInternal) return

    // 3秒后显示
    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [pathname])

  // 标记内部跳转
  useEffect(() => {
    sessionStorage.setItem('osr_internal', '1')
  }, [pathname])

  // 外部进入时清除内部标记（只在首次加载时）
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav && (nav.type === 'navigate' || nav.type === 'reload')) {
      const ref = document.referrer
      const isExternal = !ref || !ref.includes('onesilkribbon.com')
      if (isExternal) sessionStorage.removeItem('osr_internal')
    }
  }, [])

  const handleClose = () => setShow(false)

  const handleSubmit = async () => {
    if (!email.includes('@')) { setError('Please enter a valid email'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'welcome_popup' }),
      })
      const data = await res.json()
      if (data.ok) setSubmitted(true)
      else setError(data.error || 'Something went wrong')
    } catch { setError('Something went wrong, please try again') }
    setLoading(false)
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(28,23,20,0.6)',
        zIndex: 1000, backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.3s ease',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        width: 'min(560px, 92vw)',
        background: 'var(--cream)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden',
        animation: 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }} className="welcome-popup">

        {/* Left: Image / Brand panel */}
        <div style={{
          background: 'var(--ink)',
          padding: '48px 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 24 }}>
            One Silk Ribbon
          </p>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 42, fontStyle: 'italic',
            color: 'var(--cream)', lineHeight: 1.1, fontWeight: 300, margin: '0 0 24px',
          }}>
            10%<br/>off
          </p>
          <p style={{ fontSize: 11, color: '#9A8878', lineHeight: 1.8, letterSpacing: '0.05em' }}>
            your first order
          </p>
          <div style={{ width: 32, height: 1, background: 'var(--gold)', margin: '24px auto' }} />
          <p style={{ fontSize: 10, color: '#6a5a4a', lineHeight: 1.8, letterSpacing: '0.05em' }}>
            Handcrafted mulberry silk ribbons, made with love
          </p>
        </div>

        {/* Right: Form panel */}
        <div style={{ padding: '48px 32px', position: 'relative' }}>
          {/* Close button */}
          <button onClick={handleClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: 'var(--taupe)',
            fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>✕</button>

          {!submitted ? (
            <>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--ink)', marginBottom: 8 }}>
                Welcome
              </p>
              <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.8, marginBottom: 32 }}>
                Join our community and receive an exclusive discount on your first order.
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--taupe)', display: 'block', marginBottom: 8 }}>
                  Email Address
                </label>
                <input
                  type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="your@email.com"
                  style={{
                    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
                    background: '#fff', border: '1px solid var(--warm)',
                    fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
                {error && <p style={{ fontSize: 11, color: '#C0392B', marginTop: 6 }}>{error}</p>}
              </div>

              <button onClick={handleSubmit} disabled={loading} style={{
                width: '100%', padding: '14px', background: 'var(--ink)',
                border: 'none', color: 'var(--cream)', fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                cursor: loading ? 'default' : 'pointer', marginBottom: 16,
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Sending…' : 'Get My 10% Off'}
              </button>

              <button onClick={handleClose} style={{
                background: 'none', border: 'none', width: '100%',
                fontSize: 10, color: 'var(--taupe)', letterSpacing: '0.1em',
                cursor: 'pointer', textDecoration: 'underline',
              }}>
                No thanks
              </button>

              <p style={{ fontSize: 9, color: '#C0B9B0', marginTop: 20, lineHeight: 1.6 }}>
                By subscribing you agree to receive marketing emails. Unsubscribe anytime.
              </p>
            </>
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 24 }}>
              <p style={{ fontSize: 28, marginBottom: 16 }}>✦</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--ink)', marginBottom: 12 }}>
                Thank you
              </p>
              <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.8, marginBottom: 28 }}>
                Your discount code is ready to use:
              </p>
              <div style={{
                background: 'var(--ink)', color: 'var(--cream)',
                padding: '16px 24px', letterSpacing: '0.3em',
                fontSize: 18, fontFamily: 'monospace', marginBottom: 24,
              }}>
                {COUPON_CODE}
              </div>
              <p style={{ fontSize: 11, color: 'var(--taupe)', lineHeight: 1.8, marginBottom: 28 }}>
                We've also sent it to your email. Use it at checkout for 10% off your first order.
              </p>
              <button onClick={handleClose} style={{
                background: 'var(--ink)', border: 'none', color: 'var(--cream)',
                padding: '12px 32px', fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
              }}>
                Start Shopping
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translate(-50%,-48%) } to { opacity:1; transform:translate(-50%,-50%) } }
        @media(max-width:560px) { .welcome-popup { grid-template-columns:1fr !important } .welcome-popup > div:first-child { display:none !important } }
      `}</style>
    </>
  )
}
