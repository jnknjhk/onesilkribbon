'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',           label: '总览',   icon: '▤' },
  { href: '/admin/orders',    label: '订单',   icon: '◫' },
  { href: '/admin/products',  label: '产品',   icon: '◈' },
  { href: '/admin/journal',   label: '文章',   icon: '✎' },
  { href: '/admin/customers', label: '客户',   icon: '◉' },
  { href: '/admin/marketing', label: '营销',   icon: '◇' },
]

const ADMIN_PASSWORD = 'onesilk2024'

// 浅色设计系统
const C = {
  bg:        '#F5F3F0',   // 主背景：暖米白
  sidebar:   '#FFFFFF',   // 侧边栏：纯白
  border:    '#E8E4DF',   // 分割线
  card:      '#FFFFFF',   // 卡片
  cardHover: '#FAFAF8',   // 卡片hover
  gold:      '#B89B6A',   // 品牌金
  goldDark:  '#9A7E50',   // 深金
  ink:       '#1C1714',   // 主文字
  sub:       '#6B6460',   // 副文字
  muted:     '#A8A4A0',   // 弱文字
  row:       '#FAFAF8',   // 表格hover行
}

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
      setTimeout(() => { setShake(false) }, 500)
    }
  }

  // ── 登录页 ──────────────────────────────────────────────
  if (!authed) return (
    <>
      <div style={{
        minHeight: '100vh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Jost', sans-serif",
      }}>
        <div style={{ width: 360, animation: shake ? 'shake .4s ease' : 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 9, letterSpacing: '.45em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
              One Silk Ribbon
            </p>
            <p style={{ fontSize: 11, color: C.muted, letterSpacing: '.15em' }}>管理后台</p>
          </div>

          <div style={{ background: C.sidebar, border: `1px solid ${C.border}`, padding: '32px 28px' }}>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(false) }}
              onKeyDown={e => e.key === 'Enter' && tryLogin()}
              placeholder="请输入密码"
              autoFocus
              style={{
                width: '100%', padding: '11px 14px', marginBottom: 10,
                background: C.bg,
                border: `1px solid ${error ? '#D04040' : C.border}`,
                color: C.ink, fontSize: 13, outline: 'none',
                fontFamily: "'Jost', sans-serif",
                boxSizing: 'border-box', transition: 'border-color .2s',
              }}
            />
            {error && <p style={{ color: '#D04040', fontSize: 11, marginBottom: 12, letterSpacing: '.03em' }}>密码错误</p>}
            <button onClick={tryLogin} style={{
              width: '100%', padding: '11px',
              background: C.gold, border: 'none',
              color: '#fff', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              transition: 'background .2s',
            }}
              onMouseEnter={e => e.target.style.background = C.goldDark}
              onMouseLeave={e => e.target.style.background = C.gold}
            >
              进入后台
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
    </>
  )

  // ── 后台主界面 ──────────────────────────────────────────
  const currentLabel = NAV.find(n => n.href === pathname)?.label || ''

  return (
    <>
      <div style={{
        display: 'flex', minHeight: '100vh',
        background: C.bg, fontFamily: "'Jost', sans-serif", color: C.ink,
      }}>
        {/* Sidebar */}
        <aside style={{
          width: 196, flexShrink: 0,
          background: C.sidebar,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 20,
        }}>
          <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: '.4em', textTransform: 'uppercase', color: C.gold, marginBottom: 3 }}>
              One Silk Ribbon
            </p>
            <p style={{ fontSize: 10, color: C.muted }}>管理系统</p>
          </div>

          <nav style={{ flex: 1, padding: '12px 10px' }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', marginBottom: 1, borderRadius: 6,
                  background: active ? `rgba(184,155,106,0.10)` : 'transparent',
                  color: active ? C.gold : C.sub,
                  textDecoration: 'none', fontSize: 12, letterSpacing: '.03em',
                  transition: 'background .15s, color .15s',
                  fontWeight: active ? 500 : 400,
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.row; e.currentTarget.style.color = C.ink } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.sub } }}
                >
                  <span style={{ fontSize: 12 }}>{icon}</span>
                  {label}
                  {active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: C.gold }} />}
                </Link>
              )
            })}
          </nav>

          <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => { sessionStorage.removeItem('admin_authed'); setAuthed(false) }}
              style={{
                background: 'none', border: 'none', color: C.muted,
                fontSize: 11, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                letterSpacing: '.05em', padding: 0, transition: 'color .15s',
              }}
              onMouseEnter={e => e.target.style.color = C.ink}
              onMouseLeave={e => e.target.style.color = C.muted}
            >
              退出登录
            </button>
          </div>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, marginLeft: 196, display: 'flex', flexDirection: 'column' }}>
          {/* Top bar */}
          <header style={{
            height: 48, borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', padding: '0 32px',
            background: C.bg, position: 'sticky', top: 0, zIndex: 10,
          }}>
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.05em' }}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{currentLabel}</span>
          </header>

          <main style={{ flex: 1, padding: '32px', overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D4C8BE; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #B89B6A; }
        input::placeholder { color: #B0AAA6 !important; }
      `}</style>
    </>
  )
}
