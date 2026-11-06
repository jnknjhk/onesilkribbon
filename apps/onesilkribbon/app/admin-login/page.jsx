'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@osr/core/lib/supabase'
import { Suspense } from 'react'

function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(
    errorParam === 'forbidden' ? '此账号无管理员权限' : ''
  )

  const handleLogin = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('邮箱或密码错误')
      setLoading(false)
      return
    }

    // 登录成功，跳转到管理后台
    router.push('/admin')
    router.refresh()
  }

  const C = { bg: '#F5F3F0', border: '#E8E4DF', gold: '#B89B6A', ink: '#1C1714', muted: '#A8A4A0' }

  return (
    <div className="admin-login" style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Jost', sans-serif", padding: '0 20px', boxSizing: 'border-box' }}>
      <div style={{ width: 360, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: 9, letterSpacing: '.45em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>One Silk Ribbon</p>
          <h1 style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em', fontWeight: 400, margin: 0 }}>管理后台</h1>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); handleLogin() }}
          style={{ background: '#fff', border: `1px solid ${C.border}`, padding: '32px 28px' }}
        >
          {error && (
            <p id="admin-login-error" role="alert" style={{ fontSize: 12, color: '#B91C1C', textAlign: 'center', marginBottom: 20 }}>{error}</p>
          )}

          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              placeholder="邮箱"
              aria-label="邮箱"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'admin-login-error' : undefined}
              style={{
                width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`,
                fontFamily: "'Jost', sans-serif", fontSize: 13, color: C.ink,
                outline: 'none', boxSizing: 'border-box', background: '#fff',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <input
              type="password"
              placeholder="密码"
              aria-label="密码"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'admin-login-error' : undefined}
              style={{
                width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`,
                fontFamily: "'Jost', sans-serif", fontSize: 13, color: C.ink,
                outline: 'none', boxSizing: 'border-box', background: '#fff',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            style={{
              width: '100%', padding: '12px', background: loading ? C.border : C.ink,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: 13, color: '#fff',
              letterSpacing: '.08em', transition: 'background 0.2s',
            }}
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
      <style jsx global>{`
        .admin-login input:focus-visible {
          border-color: ${C.gold} !important;
          box-shadow: 0 0 0 3px rgba(184, 155, 106, .2);
        }
        .admin-login button:focus-visible {
          outline: 2px solid ${C.gold};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  )
}
