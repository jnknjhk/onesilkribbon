'use client'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { Suspense } from 'react'

function AdminLoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const handleLogin = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/admin` },
    })
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
          {error === 'forbidden' && (
            <p style={{ fontSize: 12, color: '#B91C1C', textAlign: 'center', marginBottom: 20 }}>此账号无管理员权限</p>
          )}

          <button onClick={handleLogin} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '12px', background: '#fff', border: `1px solid ${C.border}`,
            cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: 13,
            color: C.ink, letterSpacing: '.04em', transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.162 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            使用 Google 登录
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
