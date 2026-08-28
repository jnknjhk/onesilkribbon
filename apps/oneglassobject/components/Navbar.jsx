'use client'

/**
 * 顶部导航。
 *
 * 白盒画廊风：始终是半透明毛玻璃，滚动后加深并浮出细分隔线。
 * 不做"深色 Hero 上透明 + 白字"那一套——新站所有页面都是亮底，
 * 那个分支只会带来两套配色的维护负担。
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { COLLECTIONS } from '@/config/site'
import { useCart } from '@/lib/cart'
import { useAuth } from '@osr/core/lib/auth'

export function Navbar() {
  const [scrolled, setScrolled]     = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [query, setQuery] = useState('')

  const pathname = usePathname()
  const router   = useRouter()
  const accountRef = useRef(null)
  const searchInputRef = useRef(null)

  const { toggleCart, getItemCount } = useCart()
  const { user, signOut } = useAuth()
  const itemCount = getItemCount ? getItemCount() : 0

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 路由一变就收起所有浮层，否则点导航后菜单会挂在那里
  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
    setAccountOpen(false)
  }, [pathname])

  // 移动端菜单展开时锁住滚动，避免背后页面跟着动
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // 点击外部关闭账户下拉
  useEffect(() => {
    if (!accountOpen) return
    const onDown = e => {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [accountOpen])

  // Esc 关闭浮层
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      setMenuOpen(false); setSearchOpen(false); setAccountOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function submitSearch(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearchOpen(false)
    setQuery('')
    router.push(`/collections?q=${encodeURIComponent(q)}`)
  }

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
        <div className="nav-inner">
          {/* 左：移动端汉堡 */}
          <button
            className="nav-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <span className={`burger-bar ${menuOpen ? 'burger-bar--x1' : ''}`} />
            <span className={`burger-bar ${menuOpen ? 'burger-bar--hide' : ''}`} />
            <span className={`burger-bar ${menuOpen ? 'burger-bar--x2' : ''}`} />
          </button>

          {/* 中/左：品牌字标。用文字而非图片，玻璃站的调性不需要圆形头像式 logo */}
          <Link href="/" className="nav-brand" aria-label="One Glass Object — home">
            One <em>Glass</em> Object
          </Link>

          {/* 桌面端主导航 */}
          <ul className="nav-links">
            <li><Link href="/collections" className="nav-link">Collections</Link></li>
            {COLLECTIONS.slice(0, 3).map(c => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="nav-link">{c.name}</Link>
              </li>
            ))}
            <li><Link href="/about" className="nav-link">Studio</Link></li>
          </ul>

          {/* 右：搜索 / 账户 / 购物袋 */}
          <div className="nav-actions">
            <button className="nav-icon" aria-label="Search" onClick={() => setSearchOpen(v => !v)}>
              <SearchIcon />
            </button>

            <div className="nav-account" ref={accountRef}>
              {user ? (
                <>
                  <button
                    className="nav-avatar"
                    aria-label="Account menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen(v => !v)}
                  >
                    {(user.email || '?')[0].toUpperCase()}
                  </button>
                  {accountOpen && (
                    <div className="nav-dropdown">
                      <p className="nav-dropdown-email">{user.email}</p>
                      <Link href="/account" className="nav-dropdown-item">Account</Link>
                      <Link href="/account/orders" className="nav-dropdown-item">Orders</Link>
                      <Link href="/account/addresses" className="nav-dropdown-item">Addresses</Link>
                      <button className="nav-dropdown-signout" onClick={() => { setAccountOpen(false); signOut() }}>
                        Sign out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link href="/login" className="nav-icon" aria-label="Sign in"><UserIcon /></Link>
              )}
            </div>

            <button className="nav-icon nav-bag" aria-label={`Basket, ${itemCount} items`} onClick={toggleCart}>
              <BagIcon />
              {itemCount > 0 && <span className="nav-bag-count">{itemCount}</span>}
            </button>
          </div>
        </div>

        {/* 搜索条：压在导航下方展开，不遮挡品牌字标 */}
        {searchOpen && (
          <form className="nav-search" onSubmit={submitSearch}>
            <div className="nav-search-inner">
              <SearchIcon />
              <input
                ref={searchInputRef}
                className="nav-search-input"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search the collection"
                aria-label="Search"
              />
              <button type="button" className="nav-search-close" onClick={() => setSearchOpen(false)} aria-label="Close search">✕</button>
            </div>
          </form>
        )}
      </nav>

      {/* 移动端全屏菜单 */}
      {menuOpen && (
        <div className="nav-sheet">
          <nav className="nav-sheet-inner">
            <Link href="/collections" className="nav-sheet-link">All Collections</Link>
            <div className="nav-sheet-rule" />
            {COLLECTIONS.map(c => (
              <Link key={c.slug} href={`/collections/${c.slug}`} className="nav-sheet-link nav-sheet-link--sub">
                {c.name}
              </Link>
            ))}
            <div className="nav-sheet-rule" />
            <Link href="/about" className="nav-sheet-link">Studio</Link>
            <Link href="/bespoke" className="nav-sheet-link">Commissions</Link>
            <Link href="/care-guide" className="nav-sheet-link">Care</Link>
            <Link href="/contact" className="nav-sheet-link">Contact</Link>
            <div className="nav-sheet-rule" />
            {user ? (
              <>
                <Link href="/account" className="nav-sheet-link">Account</Link>
                <button className="nav-sheet-link nav-sheet-signout" onClick={() => { setMenuOpen(false); signOut() }}>
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="nav-sheet-link">Sign in</Link>
            )}
          </nav>
        </div>
      )}

      <style jsx>{`
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border-bottom: 1px solid transparent;
          transition: background var(--transition), border-color var(--transition);
        }
        .nav--scrolled { background: var(--glass-bg-alt); border-bottom-color: var(--line); }

        .nav-inner {
          height: var(--nav-h);
          max-width: 1360px; margin: 0 auto;
          padding: 0 var(--page-padding);
          display: flex; align-items: center; gap: 16px;
        }

        .nav-brand {
          font-family: var(--font-display);
          font-size: 19px; font-weight: 300; letter-spacing: 0.02em;
          color: var(--ink); white-space: nowrap;
        }
        .nav-brand em { font-style: italic; color: var(--accent-deep); }

        .nav-links {
          display: none;
          list-style: none; margin: 0 auto; padding: 0;
          gap: 32px; align-items: center;
        }
        .nav-link {
          position: relative; padding-bottom: 3px;
          font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--ink-soft); transition: color var(--transition);
        }
        .nav-link::after {
          content: ''; position: absolute; left: 0; bottom: 0;
          width: 0; height: 1px; background: var(--accent);
          transition: width var(--transition);
        }
        .nav-link:hover { color: var(--ink); }
        .nav-link:hover::after { width: 100%; }

        .nav-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }

        .nav-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 40px; height: 40px;
          background: none; border: none; color: var(--ink);
          -webkit-tap-highlight-color: transparent;
          transition: color var(--transition);
        }
        .nav-icon:hover { color: var(--accent-deep); }

        .nav-account { position: relative; display: flex; align-items: center; }
        .nav-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: var(--accent); color: #fff; border: none;
          font-size: 12px; font-family: var(--font-body);
          display: inline-flex; align-items: center; justify-content: center;
        }

        .nav-dropdown {
          position: absolute; top: calc(100% + 12px); right: 0;
          width: 224px; background: var(--paper);
          border: 1px solid var(--line); border-radius: var(--radius-sm);
          box-shadow: var(--shadow-card); overflow: hidden;
        }
        .nav-dropdown-email {
          padding: 12px 16px; font-size: 11px; color: var(--ink-faint);
          border-bottom: 1px solid var(--line);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nav-dropdown-item {
          display: block; padding: 11px 16px; font-size: 12px;
          color: var(--ink); transition: background var(--transition);
        }
        .nav-dropdown-item:hover { background: var(--paper-sunk); }
        .nav-dropdown-signout {
          display: block; width: 100%; text-align: left;
          padding: 11px 16px; background: none; border: none;
          border-top: 1px solid var(--line);
          font-family: var(--font-body); font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft);
        }
        .nav-dropdown-signout:hover { color: var(--ink); }

        .nav-bag { position: relative; }
        .nav-bag-count {
          position: absolute; top: 4px; right: 2px;
          min-width: 16px; height: 16px; padding: 0 4px;
          border-radius: 8px; background: var(--accent); color: #fff;
          font-size: 9px; line-height: 16px; text-align: center;
        }

        .nav-search { border-top: 1px solid var(--line); }
        .nav-search-inner {
          max-width: 1360px; margin: 0 auto;
          padding: 14px var(--page-padding);
          display: flex; align-items: center; gap: 12px;
          color: var(--ink-faint);
        }
        .nav-search-input {
          flex: 1; background: none; border: none; outline: none;
          font-family: var(--font-body); font-size: 16px;
          color: var(--ink); letter-spacing: 0.02em;
        }
        .nav-search-input::placeholder { color: var(--ink-faint); }
        .nav-search-close {
          background: none; border: none; color: var(--ink-faint);
          font-size: 16px; line-height: 1; padding: 4px;
        }

        /* 汉堡 */
        .nav-burger {
          display: inline-flex; flex-direction: column; justify-content: center;
          gap: 5px; width: 40px; height: 40px; margin-left: -10px;
          background: none; border: none;
          -webkit-tap-highlight-color: transparent;
        }
        .burger-bar {
          display: block; width: 20px; height: 1px; background: var(--ink);
          transition: transform var(--transition), opacity var(--transition);
        }
        .burger-bar--x1 { transform: translateY(6px) rotate(45deg); }
        .burger-bar--x2 { transform: translateY(-6px) rotate(-45deg); }
        .burger-bar--hide { opacity: 0; }

        /* 移动端全屏菜单 */
        .nav-sheet {
          position: fixed; inset: 0; z-index: 99;
          padding-top: var(--nav-h);
          background: var(--paper);
          overflow-y: auto; -webkit-overflow-scrolling: touch;
        }
        .nav-sheet-inner {
          display: flex; flex-direction: column;
          padding: 24px var(--page-padding) 64px;
        }
        .nav-sheet-link {
          padding: 13px 0; text-align: left;
          font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--ink); background: none; border: none;
          font-family: var(--font-body);
        }
        .nav-sheet-link--sub {
          padding-left: 16px; font-size: 11px;
          letter-spacing: 0.16em; color: var(--ink-soft); text-transform: none;
        }
        .nav-sheet-signout { color: var(--ink-soft); }
        .nav-sheet-rule { height: 1px; background: var(--line); margin: 16px 0; }

        @media (min-width: 1024px) {
          .nav-burger { display: none; }
          .nav-links  { display: flex; }
          .nav-brand  { font-size: 21px; }
        }
      `}</style>
    </>
  )
}

/* ── 图标：内联 SVG，避免为几个描边图形引入整个图标库 ── */

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M5 8h14l-1 12H6L5 8z" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  )
}
