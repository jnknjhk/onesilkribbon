'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',            label: '总览',    icon: '▤' },
  { href: '/admin/orders',     label: '订单',    icon: '◫' },
  { href: '/admin/products',   label: '产品',    icon: '◈' },
  { href: '/admin/inventory',  label: '库存',    icon: '◧' },
  { href: '/admin/customers',  label: '客户',    icon: '◉' },
  { href: '/admin/marketing',  label: '营销',    icon: '◇' },
]

const ADMIN_PASSWORD = 'onesilk2024'

export default function AdminLayout({ children }) {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === 'yes') setAuthed(true)
  }, [])

  const tryLogin = () => {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authed', 'yes')
      setAuthed(true)
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  if (!authed) return (
    <>
      <div style={{
        minHeight: '100vh',
        background: '#1E1C1A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Jost', sans-serif",
      }}>
        {/* Subtle grid texture */}
        <div style={{
          position: 'fixed', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(#B89B6A 1px, transparent 1px), linear-gradient(90deg, #B89B6A 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: 380,
          animation: shake ? 'shake .4s ease' : 'none',
        }}>
          {/* Logo area */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '8px 20px',
              border: '1px solid rgba(184,155,106,0.3)',
              marginBottom: 20,
            }}>
              <span style={{ width: 5, height: 5, background: '#B89B6A', borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ fontSize: 10, letterSpacing: '.45em', textTransform: 'uppercase', color: '#B89B6A' }}>One Silk Ribbon</span>
              <span style={{ width: 5, height: 5, background: '#B89B6A', borderRadius: '50%', display: 'inline-block' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase' }}>管理后台</p>
          </div>

          {/* Login box */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '36px 32px',
          }}>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(false) }}
                onKeyDown={e => e.key === 'Enter' && tryLogin()}
                placeholder="密码"
                autoFocus
                style={{
                  width: '100%', padding: '13px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${error ? 'rgba(220,80,80,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  color: '#fff', fontSize: 14, outline: 'none',
                  fontFamily: "'Jost', sans-serif", letterSpacing: '.05em',
                  boxSizing: 'border-box',
                  transition: 'border-color .2s',
                }}
              />
              {error && (
                <p style={{ color: 'rgba(220,80,80,0.9)', fontSize: 11, marginTop: 8, letterSpacing: '.05em' }}>
                  密码错误，请重试
                </p>
              )}
            </div>

            <button
              onClick={tryLogin}
              style={{
                width: '100%', padding: '13px',
                background: 'transparent',
                border: '1px solid #B89B6A',
                color: '#B89B6A',
                fontSize: 10, letterSpacing: '.35em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                transition: 'background .2s, color .2s',
              }}
              onMouseEnter={e => { e.target.style.background = '#B89B6A'; e.target.style.color = '#1E1C1A' }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#B89B6A' }}
            >
              进入后台
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0) }
          20% { transform: translateX(-10px) }
          40% { transform: translateX(10px) }
          60% { transform: translateX(-6px) }
          80% { transform: translateX(6px) }
        }
      `}</style>
    </>
  )

  const currentPage = NAV.find(n => n.href === pathname)?.label || ''

  return (
    <>
      <div style={{
        display: 'flex', minHeight: '100vh',
        background: '#1E1C1A',
        fontFamily: "'Jost', sans-serif",
        color: 'rgba(255,255,255,0.85)',
      }}>
        {/* Sidebar */}
        <aside style={{
          width: 200, flexShrink: 0,
          background: '#181614',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, bottom: 0, left: 0,
          zIndex: 10,
        }}>
          {/* Brand */}
          <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 9, letterSpacing: '.4em', textTransform: 'uppercase', color: '#B89B6A', marginBottom: 3 }}>One Silk Ribbon</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '.08em' }}>管理系统</p>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '16px 12px' }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 12px', marginBottom: 2,
                  background: active ? 'rgba(184,155,106,0.1)' : 'transparent',
                  color: active ? '#B89B6A' : 'rgba(255,255,255,0.35)',
                  textDecoration: 'none', fontSize: 12, letterSpacing: '.04em',
                  borderRadius: 4,
                  transition: 'color .15s, background .15s',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
                >
                  <span style={{ fontSize: 13, opacity: active ? 1 : 0.6 }}>{icon}</span>
                  {label}
                  {active && <span style={{ marginLeft: 'auto', width: 3, height: 3, borderRadius: '50%', background: '#B89B6A', display: 'inline-block' }} />}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { sessionStorage.removeItem('admin_authed'); setAuthed(false) }}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.2)', fontSize: 11,
                cursor: 'pointer', letterSpacing: '.08em',
                fontFamily: "'Jost', sans-serif",
                transition: 'color .15s', padding: 0,
              }}
              onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.5)'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.2)'}
            >
              退出登录
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, marginLeft: 200, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* Top bar */}
          <header style={{
            height: 52,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center',
            padding: '0 36px',
            position: 'sticky', top: 0,
            background: '#1E1C1A',
            zIndex: 5,
          }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '.08em' }}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '.05em' }}>
              {currentPage}
            </span>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, padding: '36px', overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(184,155,106,0.25); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(184,155,106,0.45); }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        select option { background: #1E1C1A; }
      `}</style>
    </>
  )
}
