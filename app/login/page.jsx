'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const next = searchParams.get('next') || '/account'
  const [signing, setSigning] = useState(false)

  // 已登录则直接跳走
  useEffect(() => {
    if (!loading && user) router.replace(next)
  }, [user, loading, next, router])

  const handleGoogleLogin = async () => {
    setSigning(true)
    await signInWithGoogle(next)
  }

  if (loading || user) return null

  return (
    <>
      <div style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 40px',
        fontFamily: 'var(--font-body)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Logo 区 */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Link href="/">
              <img
                src="/images/logo.png"
                alt="One Silk Ribbon"
                style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px' }}
              />
            </Link>
            <p style={{
              fontSize: 9, letterSpacing: '.42em', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: 8,
            }}>
              One Silk Ribbon
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28, fontWeight: 300,
              color: 'var(--ink)', lineHeight: 1.2,
            }}>
              Sign in to your account
            </h1>
            <p style={{ fontSize: 13, color: 'var(--taupe)', marginTop: 10, lineHeight: 1.6 }}>
              View your orders, manage addresses<br />and track your deliveries.
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              padding: '12px 16px', marginBottom: 24, borderRadius: 4,
              fontSize: 13, color: '#B91C1C', textAlign: 'center',
            }}>
              {error === 'auth_failed'
                ? 'Sign-in failed. Please try again.'
                : 'Something went wrong. Please try again.'}
            </div>
          )}

          {/* 登录卡片 */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sand)',
            padding: '36px 32px',
          }}>
            {/* Google 登录按钮 */}
            <button
              onClick={handleGoogleLogin}
              disabled={signing}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '13px 20px',
                background: signing ? 'var(--mist)' : '#fff',
                border: '1px solid var(--sand)',
                cursor: signing ? 'default' : 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => { if (!signing) e.currentTarget.style.borderColor = 'var(--warm)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sand)' }}
            >
              {/* Google SVG */}
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.162 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              <span style={{
                fontSize: 13, letterSpacing: '.06em',
                color: 'var(--ink)', fontWeight: 400,
              }}>
                {signing ? 'Redirecting…' : 'Continue with Google'}
              </span>
            </button>

            {/* 分割线 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '24px 0',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--sand)' }} />
              <span style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                Secure sign-in
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--sand)' }} />
            </div>

            {/* 说明文字 */}
            <p style={{
              fontSize: 11, color: 'var(--taupe)', textAlign: 'center',
              lineHeight: 1.7, letterSpacing: '.02em',
            }}>
              We use Google for secure authentication.<br />
              No password needed — just your Google account.
            </p>
          </div>

          {/* 底部链接 */}
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link href="/track-order" style={{
              fontSize: 11, color: 'var(--taupe)', letterSpacing: '.12em',
              textTransform: 'uppercase', textDecoration: 'none',
              borderBottom: '1px solid transparent',
              transition: 'border-color 0.2s, color 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--gold)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--taupe)'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              Track an order without signing in →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
