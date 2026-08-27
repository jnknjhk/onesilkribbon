'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// 这个页面现在只是一个过渡页，session 已在服务端完成
function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const next = searchParams.get('next') || '/account'
    router.replace(next)
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontSize: 12, color: 'var(--taupe)', letterSpacing: '.06em' }}>Signing you in…</p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg) } }` }} />
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
