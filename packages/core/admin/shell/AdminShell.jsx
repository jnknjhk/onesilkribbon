'use client'
// 后台外框：左侧 7 个入口（按你每天做的事分，而不是按数据库表分）、顶栏、手机端抽屉菜单、轻提示。
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../lib/supabase'
import { AdminConfigProvider } from '../config'
import { COUNTS_EVENT } from '../lib/counts'
import { clearApiCache } from '../lib/api'
import AdminLoading from '../AdminLoading'
import { Icon, ToastProvider, Button, cx, styles as s } from '../ui'

export const NAV = [
  { href: '/admin',           label: '工作台', icon: 'home', exact: true },
  { href: '/admin/orders',    label: '订单',   icon: 'package', badge: 'toShip' },
  { href: '/admin/products',  label: '商品',   icon: 'tag' },
  { href: '/admin/customers', label: '客户',   icon: 'users' },
  { href: '/admin/content',   label: '内容',   icon: 'file' },
  { href: '/admin/marketing', label: '营销',   icon: 'megaphone' },
  { href: '/admin/settings',  label: '设置',   icon: 'settings' },
]

function isActive(item, pathname) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function AdminShell({ config, children }) {
  const pathname = usePathname() || '/admin'
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)
  const [toShip, setToShip] = useState(null)

  useEffect(() => { setNavOpen(false) }, [pathname])

  // 订单入口上的"待发货"数字：打开后台时查一次，之后每 3 分钟、或者切回这个窗口时再查
  // （以前每切一次页面都查一遍）。订单列表 / 工作台拿到数字会直接告诉这里，发货退款后会通知这里重查
  useEffect(() => {
    let cancelled = false
    let last = 0
    const load = () => {
      last = Date.now()
      fetch('/api/admin/orders?countsOnly=1')
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (!cancelled && d?.counts) setToShip(d.counts.to_ship || 0) })
        .catch(() => {})
    }
    const onFocus = () => { if (Date.now() - last > 30000) load() }
    const onEvent = e => {
      if (e.detail?.refresh) load()
      else if (Number.isFinite(e.detail?.toShip)) { last = Date.now(); setToShip(e.detail.toShip) }
    }
    load()
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') load() }, 180000) // 后台标签页不查
    window.addEventListener('focus', onFocus)
    window.addEventListener(COUNTS_EVENT, onEvent)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(COUNTS_EVENT, onEvent)
    }
  }, [])

  async function signOut() {
    clearApiCache()
    await createSupabaseBrowserClient().auth.signOut()
    router.push('/admin-login')
  }

  const current = NAV.find(n => isActive(n, pathname))

  return (
    <AdminConfigProvider config={config}>
      <ToastProvider>
        <div className={s.root}>
          {navOpen && <div className={s.overlay} onClick={() => setNavOpen(false)} />}
          <aside className={cx(s.sidebar, navOpen && s.sidebarOpen)}>
            <div className={s.brand}>
              <div className={s.brandName}>{config.brand}</div>
              <div className={s.brandSub}>店铺后台</div>
            </div>
            <nav className={s.nav}>
              {NAV.map(item => {
                const active = isActive(item, pathname)
                const count = item.badge === 'toShip' ? toShip : null
                return (
                  // prefetch：页面外框提前取好并保留 5 分钟（默认只保留 30 秒，过后再点又要等一个来回）
                  <Link key={item.href} href={item.href} prefetch className={cx(s.navItem, active && s.navItemActive)} aria-current={active ? 'page' : undefined}>
                    <Icon name={item.icon} size={18} />
                    {item.label}
                    {count > 0 && <span className={cx(s.navBadge, s.num)} title={`${count} 单待发货`}>{count}</span>}
                  </Link>
                )
              })}
            </nav>
            <div className={s.sidebarFoot}>
              <a href={config.siteUrl} target="_blank" rel="noopener noreferrer" className={s.navItem}>
                <Icon name="external" size={18} />查看网站
              </a>
              <button type="button" onClick={signOut} className={s.navItem} style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }}>
                <Icon name="logout" size={18} />退出登录
              </button>
            </div>
          </aside>

          <div className={s.main}>
            <header className={s.topbar}>
              <Button variant="ghost" iconOnly icon="menu" className={s.menuBtn} onClick={() => setNavOpen(true)} aria-label="打开菜单" />
              <span className={s.topbarTitle}>{current?.label || '后台'}</span>
            </header>
            <main className={s.content}>
              {/* 用了 useSearchParams 的页面必须包在 Suspense 里，否则 Next 构建时会报错 */}
              <Suspense fallback={<AdminLoading />}>{children}</Suspense>
            </main>
          </div>
        </div>
      </ToastProvider>
    </AdminConfigProvider>
  )
}
