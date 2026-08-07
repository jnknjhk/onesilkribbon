'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth'

const NAV = [
  {
    href: '/account',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/account/orders',
    label: 'My Orders',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    href: '/account/addresses',
    label: 'Addresses',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    href: '/account/profile',
    label: 'Profile',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function AccountLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  // 未登录跳转
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${pathname}`)
    }
  }, [user, loading, pathname, router])

  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cream)',
      }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg) } }` }} />
      </div>
    )
  }

  const getInitial = () => {
    if (user.name) return user.name.charAt(0).toUpperCase()
    if (user.email) return user.email.charAt(0).toUpperCase()
    return '?'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      fontFamily: 'var(--font-body)',
      paddingTop: 72,
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px clamp(20px, 5vw, 48px)',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 40,
        alignItems: 'start',
      }}
        className="account-grid"
      >
        {/* ── 侧边栏 ── */}
        <aside>
          {/* 用户卡片 */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sand)',
            padding: '24px 20px',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--gold)' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {getInitial()}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name || 'My Account'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--taupe)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* 导航 */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV.map(({ href, label, icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px',
                    borderRadius: 4,
                    background: active ? 'rgba(184,155,106,0.08)' : 'transparent',
                    color: active ? 'var(--gold)' : 'var(--deep)',
                    fontSize: 12, letterSpacing: '.03em',
                    textDecoration: 'none',
                    transition: 'background 0.15s, color 0.15s',
                    fontWeight: active ? 400 : 300,
                  }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--mist)'; e.currentTarget.style.color = 'var(--ink)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--deep)' } }}
                  >
                    <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
                    {label}
                    {active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* 退出 */}
          <button
            onClick={signOut}
            style={{
              width: '100%', background: 'none', border: '1px solid var(--sand)',
              padding: '10px 16px', cursor: 'pointer',
              fontSize: 11, color: 'var(--taupe)', letterSpacing: '.12em',
              textTransform: 'uppercase', fontFamily: 'var(--font-body)',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--warm)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sand)'; e.currentTarget.style.color = 'var(--taupe)' }}
          >
            Sign out
          </button>
        </aside>

        {/* ── 主内容 ── */}
        <main style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .account-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      ` }} />
    </div>
  )
}
