'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@osr/core/lib/supabase'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin',           label: '总览',   icon: '▤' },
  { href: '/admin/orders',    label: '订单',   icon: '◫' },
  { href: '/admin/products',  label: '产品',   icon: '◈' },
  { href: '/admin/media',     label: '媒体库', icon: '▦' },
  { href: '/admin/images',    label: '网站图片', icon: '◻' },
  { href: '/admin/journal',   label: '文章',   icon: '✎' },
  { href: '/admin/customers', label: '客户',   icon: '◉' },
  { href: '/admin/subscribers', label: '订阅用户', icon: '▧' },
  { href: '/admin/marketing', label: '营销',   icon: '◇' },
  { href: '/admin/email',     label: '发邮件', icon: '✉' },
]

const C = {
  bg: '#F5F3F0', sidebar: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', goldDark: '#9A7E50', ink: '#1C1714',
  sub: '#6B6460', muted: '#A8A4A0', row: '#FAFAF8',
}

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)

  // 切换页面后自动收起移动端抽屉菜单
  useEffect(() => { setNavOpen(false) }, [pathname])

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/admin-login')
  }

  const currentLabel = NAV.find(n => n.href === pathname)?.label || ''

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Jost', sans-serif", color: C.ink }}>
        {navOpen && (
          <div onClick={() => setNavOpen(false)} className="admin-nav-overlay" />
        )}

        <aside className={`admin-sidebar ${navOpen ? 'admin-sidebar-open' : ''}`} style={{ width: 196, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 30 }}>
          <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 9, letterSpacing: '.4em', textTransform: 'uppercase', color: C.gold, marginBottom: 3 }}>One Silk Ribbon</p>
              <p style={{ fontSize: 10, color: C.muted }}>管理系统</p>
            </div>
            <button onClick={() => setNavOpen(false)} className="admin-nav-close" aria-label="关闭菜单"
              style={{ display: 'none', background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
          </div>

          <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 10px', marginBottom: 1, borderRadius: 6, background: active ? `rgba(184,155,106,0.10)` : 'transparent', color: active ? C.gold : C.sub, textDecoration: 'none', fontSize: 13, letterSpacing: '.03em', transition: 'background .15s, color .15s', fontWeight: active ? 500 : 400 }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.row; e.currentTarget.style.color = C.ink } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.sub } }}
                >
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  {label}
                  {active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: C.gold }} />}
                </Link>
              )
            })}
          </nav>

          <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: "'Jost', sans-serif", letterSpacing: '.05em', padding: '6px 0' }}
              onMouseEnter={e => e.target.style.color = C.ink}
              onMouseLeave={e => e.target.style.color = C.muted}
            >
              退出登录
            </button>
          </div>
        </aside>

        <div className="admin-main" style={{ flex: 1, marginLeft: 196, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
          <header style={{ height: 48, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 32px', background: C.bg, position: 'sticky', top: 0, zIndex: 10 }} className="admin-header">
            <button onClick={() => setNavOpen(true)} className="admin-nav-toggle" aria-label="打开菜单"
              style={{ display: 'none', background: 'none', border: 'none', fontSize: 20, color: C.ink, cursor: 'pointer', padding: '8px', marginLeft: -8, marginRight: 4 }}>☰</button>
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.05em' }} className="admin-header-date">
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink, fontWeight: 500 }}>{currentLabel}</span>
          </header>
          <main className="admin-content" style={{ padding: '32px' }}>{children}</main>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D4C8BE; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #B89B6A; }
        input::placeholder { color: #B0AAA6 !important; }

        .admin-nav-overlay { display: none; }

        @media (max-width: 900px) {
          .admin-sidebar { transform: translateX(-100%); transition: transform .25s ease; box-shadow: 4px 0 24px rgba(0,0,0,0.12); }
          .admin-sidebar-open { transform: translateX(0); }
          .admin-nav-close { display: block !important; }
          .admin-nav-toggle { display: block !important; }
          .admin-nav-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 25; }
          .admin-main { margin-left: 0 !important; }
          .admin-header { padding: 0 16px !important; }
          .admin-header-date { display: none; }
          .admin-content { padding: 16px !important; }
        }
      ` }} />
    </>
  )
}
