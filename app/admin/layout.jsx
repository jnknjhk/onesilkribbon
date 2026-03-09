'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin', label: '总览', icon: '◎' },
  { href: '/admin/orders', label: '订单管理', icon: '📦' },
  { href: '/admin/products', label: '产品管理', icon: '🎀' },
  { href: '/admin/inventory', label: '库存管理', icon: '📊' },
  { href: '/admin/customers', label: '客户管理', icon: '👤' },
  { href: '/admin/marketing', label: '营销管理', icon: '🎁' },
]

const ADMIN_PASSWORD = 'onesilk2024'

export default function AdminLayout({ children }) {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === 'yes') setAuthed(true)
  }, [])

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '48px 40px', width: 360, textAlign: 'center' }}>
        <p style={{ color: '#B89B6A', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 12 }}>One Silk Ribbon</p>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 300, marginBottom: 32 }}>后台管理</h1>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false) }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_authed', 'yes'); setAuthed(true) }
              else setError(true)
            }
          }}
          placeholder="请输入管理密码"
          style={{ width: '100%', padding: '12px 16px', background: '#111', border: `1px solid ${error ? '#e55' : '#333'}`, borderRadius: 6, color: '#fff', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: '#e55', fontSize: 12, marginBottom: 12 }}>密码错误</p>}
        <button
          onClick={() => {
            if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_authed', 'yes'); setAuthed(true) }
            else setError(true)
          }}
          style={{ width: '100%', padding: '12px', background: '#B89B6A', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, letterSpacing: '.2em', cursor: 'pointer' }}
        >
          登录
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f0f', fontFamily: "'Jost', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#141414', borderRight: '1px solid #222', padding: '32px 0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '0 24px 32px', borderBottom: '1px solid #222' }}>
          <p style={{ color: '#B89B6A', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>One Silk Ribbon</p>
          <p style={{ color: '#555', fontSize: 11 }}>后台管理系统</p>
        </div>
        <nav style={{ padding: '24px 12px', flex: 1 }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                background: active ? '#1f1f1f' : 'transparent',
                color: active ? '#fff' : '#666',
                textDecoration: 'none', fontSize: 13,
                borderLeft: active ? '2px solid #B89B6A' : '2px solid transparent',
                transition: 'all .15s',
              }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #222' }}>
          <button onClick={() => { sessionStorage.removeItem('admin_authed'); setAuthed(false) }}
            style={{ background: 'none', border: 'none', color: '#444', fontSize: 12, cursor: 'pointer' }}>
            退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: '40px' }}>
        {children}
      </main>
    </div>
  )
}
