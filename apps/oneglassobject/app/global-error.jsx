'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// app/error.jsx 只能捕获路由段内部的渲染错误——如果根 layout.jsx 本身抛错，
// Next.js 会整个跳过它，改用这个文件。这里必须自带完整的 <html>/<body>，
// 也不能依赖 globals.css（layout 都没跑起来，样式表不一定加载了），所以用内联样式。
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: 'Georgia, serif', background: '#F7F3EE' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <p style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 300, color: '#1C1714', marginBottom: 16 }}>
              Something went wrong
            </p>
            <p style={{ fontSize: 14, color: '#6B6460', lineHeight: 1.8, marginBottom: 32 }}>
              We&apos;re sorry for the inconvenience. Please try again, or contact us if the problem persists.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={reset}
                style={{ padding: '14px 32px', background: '#1C1714', color: '#fff', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                Try Again
              </button>
              <a href="/"
                style={{ padding: '14px 32px', background: 'transparent', color: '#1C1714', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none', border: '1px solid #E8DDD0' }}>
                Return Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
