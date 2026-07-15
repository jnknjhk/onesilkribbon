'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin',           label: '总览',   icon: '▤' },
  { href: '/admin/orders',    label: '订单',   icon: '◫' },
  { href: '/admin/products',  label: '产品',   icon: '◈' },
  { href: '/admin/images',    label: '图片',   icon: '◻' },
  { href: '/admin/journal',   label: '文章',   icon: '✎' },
  { href: '/admin/customers', label: '客户',   icon: '◉' },
  { href: '/admin/marketing', label: '营销',   icon: '◇' },
]

const C = {
  bg: '#F5F3F0', sidebar: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', goldDark: '#9A7E50', ink: '#1C1714',
  sub: '#6B6460', muted: '#A8A4A0', row: '#FAFAF8',
}

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/admin-login')
  }

  const currentLabel = NAV.find(n => n.href === pathname)?.label || ''

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Jost', sans-serif", color: C.ink }}>
        <aside style={{ width: 196, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 20 }}>
          <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: '.4em', textTransform: 'uppercase', color: C.gold, marginBottom: 3 }}>One Silk Ribbon</p>
            <p style={{ fontSize: 10, color: C.muted }}>管理系统</p>
          </div>

          <nav style={{ flex: 1, padding: '12px 10px' }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 1, borderRadius: 6, background: active ? `rgba(184,155,106,0.10)` : 'transparent', color: active ? C.gold : C.sub, textDecoration: 'none', fontSize: 12, letterSpacing: '.03em', transition: 'background .15s, color .15s', fontWeight: active ? 500 : 400 }}
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
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: "'Jost', sans-serif", letterSpacing: '.05em', padding: 0, transition: 'color .15s' }}
              onMouseEnter={e => e.target.style.color = C.ink}
              onMouseLeave={e => e.target.style.color = C.muted}
            >
              退出登录
            </button>
          </div>
        </aside>

        <div style={{ flex: 1, marginLeft: 196, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <header style={{ height: 48, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 32px', background: C.bg, position: 'sticky', top: 0, zIndex: 10 }}>
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.05em' }}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{currentLabel}</span>
          </header>
          <main style={{ padding: '32px' }}>{children}</main>
        </div>
      </div>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #D4C8BE; border-radius: 2px; } ::-webkit-scrollbar-thumb:hover { background: #B89B6A; } input::placeholder { color: #B0AAA6 !important; }`}</style>
    </>
  )
}
