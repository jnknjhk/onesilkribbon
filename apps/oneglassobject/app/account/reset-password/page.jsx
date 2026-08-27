'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@osr/core/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase redirects with hash tokens — wait for session to be set
    const supabase = createSupabaseBrowserClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const handleReset = async () => {
    if (!password) { setError('Please enter a new password'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.replace('/account'), 2000)
  }

  const C = { gold: '#B89B6A', ink: '#1C1714', taupe: '#A8A4A0', border: '#E8E4DF', cream: '#F5F3F0' }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: 9, letterSpacing: '.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>One Glass Object</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: C.ink }}>Set New Password</h1>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.border}`, padding: '32px 28px' }}>
          {success ? (
            <p style={{ fontSize: 13, color: '#166534', textAlign: 'center', lineHeight: 1.7 }}>
              ✓ Password updated successfully. Redirecting…
            </p>
          ) : !ready ? (
            <p style={{ fontSize: 13, color: C.taupe, textAlign: 'center', lineHeight: 1.7 }}>
              Verifying your reset link…
            </p>
          ) : (
            <>
              {error && <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 16 }}>{error}</p>}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.taupe, display: 'block', marginBottom: 6 }}>New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.taupe, display: 'block', marginBottom: 6 }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="Repeat new password" className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleReset} disabled={loading} className="btn-primary" style={{ width: '100%' }}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
