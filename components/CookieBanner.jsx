'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('osr_cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('osr_cookie_consent', 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('osr_cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      <div className="cookie-banner">
        <p style={{
          fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8,
          flex: 1, minWidth: 0,
        }}>
          We use cookies to keep your basket and understand how you use our site.{' '}
          <Link href="/cookies" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            Cookie Policy
          </Link>
        </p>
        <div className="cookie-actions">
          <button onClick={decline} style={{
            padding: '10px 24px', background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.2em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            transition: 'border-color .2s, color .2s',
            minHeight: 44,
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.5)'; e.target.style.color = '#fff' }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.color = 'rgba(255,255,255,0.5)' }}
          >
            Decline
          </button>
          <button onClick={accept} style={{
            padding: '10px 24px', background: 'var(--gold)',
            border: '1px solid var(--gold)',
            fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.2em',
            textTransform: 'uppercase', color: '#fff', cursor: 'pointer',
            transition: 'opacity .2s',
            minHeight: 44,
          }}
            onMouseEnter={e => e.target.style.opacity = '.85'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Accept
          </button>
        </div>
      </div>

      <style>{`
        .cookie-banner {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 999;
          background: var(--ink);
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 16px var(--page-padding, 24px);
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; flex-wrap: wrap;
        }
        .cookie-actions {
          display: flex; gap: 10px; flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .cookie-banner {
            flex-direction: column;
            align-items: stretch;
            padding: 16px 20px 20px;
            gap: 12px;
          }
          .cookie-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .cookie-actions button { width: 100%; }
        }
      `}</style>
    </>
  )
}
