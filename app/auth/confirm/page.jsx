'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const next = searchParams.get('next') || '/account'

    if (!code) { router.replace('/login?error=no_code'); return }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { flowType: 'pkce', persistSession: true } }
    )

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error('Exchange error:', error)
        router.replace('/login?error=auth_failed')
      } else {
        router.replace(next)
      }
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontSize: 12, color: 'var(--taupe)', letterSpacing: '.06em' }}>Signing you in…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmContent />
    </Suspense>
  )
}
