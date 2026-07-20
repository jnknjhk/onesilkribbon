'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

function LoginContent() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const next = searchParams.get('next') || '/account'

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(errorParam === 'auth_failed' ? 'Sign-in failed. Please try again.' : '')
  const [success, setSuccess] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace(next)
  }, [user, loading])

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { setForgotMsg('Please enter your email'); return }
    setForgotLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    })
    if (error) setForgotMsg('Something went wrong. Please try again.')
    else setForgotMsg('Password reset email sent. Please check your inbox.')
    setForgotLoading(false)
  }

  const handleEmailSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setSubmitting(true); setError('')
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
        router.replace(next)
      } else {
        if (!name) { setError('Please enter your name'); setSubmitting(false); return }
        await signUpWithEmail(email, password, name)
        setSuccess('Account created! Please check your email to verify your account.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
    setSubmitting(false)
  }

  if (loading || user) return null

  const C = { gold: 'var(--gold)', ink: 'var(--ink)', taupe: 'var(--taupe)', cream: 'var(--cream)', warm: 'var(--warm)', sand: 'var(--sand)' }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 40px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/"><img src="/images/logo.png" alt="One Silk Ribbon" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px', display: 'block' }} /></Link>
          <p style={{ fontSize: 9, letterSpacing: '.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>One Silk Ribbon</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: C.ink }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </h1>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 16px', marginBottom: 20, borderRadius: 4, fontSize: 13, color: '#B91C1C', textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', padding: '12px 16px', marginBottom: 20, borderRadius: 4, fontSize: 13, color: '#15803D', textAlign: 'center' }}>{success}</div>}

        {!success && (
          <div style={{ background: '#fff', border: '1px solid var(--warm)', padding: '32px 28px', marginBottom: 16 }}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.taupe, display: 'block', marginBottom: 6 }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.taupe, display: 'block', marginBottom: 6 }}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()} placeholder="you@example.com" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.taupe, display: 'block', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()} placeholder="••••••••" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: 16, marginTop: -8 }}>
                <button onClick={() => { setShowForgot(true); setForgotMsg(''); setForgotEmail(email) }}
                  style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 11, letterSpacing: '.04em' }}>
                  Forgot password?
                </button>
              </div>
            )}

            <button onClick={handleEmailSubmit} disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--warm)' }} />
              <span style={{ fontSize: 11, color: C.taupe }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--warm)' }} />
            </div>

            <button onClick={() => signInWithGoogle(next)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px', background: '#fff', border: '1px solid var(--warm)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, color: C.ink, letterSpacing: '.04em',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.162 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        )}

        {showForgot && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', padding: 32, width: '100%', maxWidth: 380, borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontSize: 15, color: C.ink }}>Reset Password</p>
                <button onClick={() => { setShowForgot(false); setForgotMsg('') }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted }}>×</button>
              </div>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.7 }}>Enter your email address and we'll send you a link to reset your password.</p>
              {forgotMsg ? (
                <p style={{ fontSize: 13, color: forgotMsg.includes('sent') ? '#166534' : '#991b1b', lineHeight: 1.7 }}>{forgotMsg}</p>
              ) : (
                <>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                    placeholder="your@email.com" className="input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
                  <button onClick={handleForgotPassword} disabled={forgotLoading} className="btn-primary" style={{ width: '100%' }}>
                    {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 13, color: C.taupe }}>
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}
            style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginContent /></Suspense>
}
