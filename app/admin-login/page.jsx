'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
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
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: 9, letterSpacing: '.45em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>One Silk Ribbon</p>
          <p style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em' }}>管理后台</p>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.border}`, padding: '32px 28px' }}>
          {error && (
            <p style={{ fontSize: 12, color: '#B91C1C', textAlign: 'center', marginBottom: 20 }}>{error}</p>
          )}

          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`,
                fontFamily: "'Jost', sans-serif", fontSize: 13, color: C.ink,
                outline: 'none', boxSizing: 'border-box', background: '#fff',
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: loading ? C.border : C.ink,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: 13, color: '#fff',
              letterSpacing: '.08em', transition: 'background 0.2s',
            }}
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </div>
      </div>
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
