'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 68, fontFamily: 'var(--font-body)' }}>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <p style={{ fontSize: 9, letterSpacing: '.42em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20 }}>Something went wrong</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 20 }}>
          An unexpected error occurred
        </h1>
        <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 1.9, maxWidth: 400, margin: '0 auto 48px' }}>
          We're sorry for the inconvenience. Please try again or contact us if the problem persists.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset}
            style={{ display: 'inline-block', padding: '14px 36px', background: 'var(--ink)', color: '#fff', fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Try Again
          </button>
          <Link href="/"
            style={{ display: 'inline-block', padding: '14px 36px', background: 'transparent', color: 'var(--ink)', fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', textDecoration: 'none', border: '1px solid var(--warm)' }}>
            Return Home
          </Link>
        </div>
        <p style={{ marginTop: 32, fontSize: 12, color: 'var(--taupe)' }}>
          Need help? <a href="mailto:song@onesilkribbon.com" style={{ color: 'var(--gold)' }}>song@onesilkribbon.com</a>
        </p>
      </div>
    </div>
  )
}
