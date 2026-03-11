'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef(null)
  const searchTimerRef = useRef(null)
  const pathname = usePathname()
  const router = useRouter()

  const { toggleCart, getItemCount } = useCart()
  const itemCount = getItemCount ? getItemCount() : 0

  const isDarkHero = pathname === '/'
  const isLight = isDarkHero && !scrolled && !menuOpen && !searchOpen

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (menuOpen || searchOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, searchOpen])

  // 搜索打开时自动聚焦
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
    if (!searchOpen) { setSearchQuery(''); setSearchResults([]) }
  }, [searchOpen])

  // 搜索防抖
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (searchQuery.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery])

  const handleSearchClick = (slug) => {
    setSearchOpen(false)
    router.push(`/products/${slug}`)
  }

  const textColor = isLight ? '#fff' : 'var(--deep)'
  const logoSrc = isLight ? '/images/logo-white.png' : '/images/logo.png'
  const iconStroke = isLight ? '#fff' : 'var(--deep)'
  const shadow = isLight ? '0 1px 8px rgba(0,0,0,0.3)' : 'none'

  const navLinks = [
    { href: '/collections', label: 'Shop' },
    { href: '/about',       label: 'About' },
    { href: '/bespoke',     label: 'Bespoke' },
  ]

  const mobileCollections = [
    { name: 'Fine Silk Ribbons',      slug: 'fine-silk-ribbons' },
    { name: 'Hand-Frayed',            slug: 'hand-frayed-silk-ribbons' },
    { name: 'Handcrafted Adornments', slug: 'handcrafted-adornments' },
    { name: 'Patterned Ribbons',      slug: 'patterned-ribbons' },
    { name: 'Studio Tools',           slug: 'studio-tools' },
    { name: 'Vintage-Inspired',       slug: 'vintage-inspired-ribbons' },
  ]

  const mobileLinks = [
    { name: 'Our Story',       href: '/about' },
    { name: 'Bespoke & Trade', href: '/bespoke' },
    { name: 'Journal',         href: '/journal' },
    { name: 'Contact',         href: '/contact' },
  ]

  return (
    <>
      <nav className="site-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? '8px 0' : '14px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: (scrolled || menuOpen || searchOpen) ? 'rgba(247,243,238,0.95)' : 'transparent',
        backdropFilter: (scrolled || menuOpen || searchOpen) ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--sand)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        {/* ── 左：Logo + 品牌名 ── */}
        <Link href="/" onClick={() => { setMenuOpen(false); setSearchOpen(false) }} className="nav-brand">
          <img src={logoSrc} alt="One Silk Ribbon" className="nav-logo" style={{ transition: 'opacity 0.3s' }} />
          <span className="nav-brand-text" style={{
            color: isLight ? '#fff' : 'var(--ink)',
            textShadow: shadow,
            transition: 'color 0.4s, text-shadow 0.4s',
          }}>
            One <em>Silk</em> Ribbon
          </span>
        </Link>

        {/* ── 中：桌面端导航链接 ── */}
        <ul className="nav-desktop nav-links">
          {navLinks.map(l => (
            <li key={l.href}>
              <Link href={l.href} className="nav-link" style={{
                color: textColor,
                textShadow: isLight ? '0 1px 6px rgba(0,0,0,0.25)' : 'none',
                transition: 'color 0.4s, text-shadow 0.4s',
              }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* ── 右：图标组 ── */}
        <div className="nav-icons">
          {/* 搜索 */}
          <button onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false) }} className="nav-icon-btn" aria-label="Search">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
              stroke={searchOpen ? 'var(--deep)' : iconStroke} strokeWidth="1.4"
              style={{ transition: 'stroke 0.4s', filter: isLight ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' : 'none' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* 购物车 */}
          <button onClick={toggleCart} className="nav-icon-btn" aria-label="Cart" style={{ position: 'relative' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
              stroke={iconStroke} strokeWidth="1.4"
              style={{ transition: 'stroke 0.4s', filter: isLight ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' : 'none' }}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {itemCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0,
                background: 'var(--gold)', color: '#fff',
                width: 15, height: 15, borderRadius: '50%',
                fontSize: 9, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 400,
              }}>
                {itemCount}
              </span>
            )}
          </button>

          {/* 汉堡菜单（移动端） */}
          <button onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false) }}
            className="nav-mobile nav-icon-btn" aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
              stroke={menuOpen ? 'var(--ink)' : iconStroke} strokeWidth="1.3"
              style={{ transition: 'stroke 0.4s' }}>
              {menuOpen ? (
                <><line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/></>
              ) : (
                <><line x1="3" y1="7" x2="19" y2="7"/><line x1="3" y1="11" x2="19" y2="11"/><line x1="3" y1="15" x2="19" y2="15"/></>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* ══════ 搜索弹出层 ══════ */}
      {searchOpen && (
        <>
          <div onClick={() => setSearchOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 98,
            background: 'rgba(28,23,20,0.4)', backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.2s ease',
          }} />
          <div className="search-panel">
            <div className="search-inner">
              <div className="search-input-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--taupe)" strokeWidth="1.4" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products…"
                  className="search-input"
                />
                <button onClick={() => setSearchOpen(false)} style={{
                  background: 'none', border: 'none', color: 'var(--taupe)',
                  fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
                }}>✕</button>
              </div>

              {/* 搜索结果 */}
              <div className="search-results">
                {searching && (
                  <p style={{ padding: '20px 0', fontSize: 12, color: 'var(--taupe)', textAlign: 'center' }}>Searching…</p>
                )}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--taupe)', textAlign: 'center' }}>
                    No products found for "{searchQuery}"
                  </p>
                )}
                {searchResults.map(p => {
                  const img = Array.isArray(p.images) ? p.images[0] : null
                  return (
                    <button key={p.id} onClick={() => handleSearchClick(p.slug)} className="search-result-item">
                      <div className="search-result-img">
                        {img ? <img src={img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3, textAlign: 'left' }}>{p.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'left' }}>
                          {(p.collection || '').replace(/-/g, ' ')}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════ 移动端菜单 ══════ */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'var(--cream)', paddingTop: 72,
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ padding: '20px 32px 40px', display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--sand)' }}>Shop</p>
            {mobileCollections.map(c => (
              <Link key={c.slug} href={`/collections/${c.slug}`} onClick={() => setMenuOpen(false)}
                style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: 'var(--ink)', padding: '12px 0', borderBottom: '1px solid var(--mist)' }}>
                {c.name}
              </Link>
            ))}
            <div style={{ height: 1, width: '100%', background: 'var(--sand)', margin: '24px 0 20px' }} />
            <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Explore</p>
            {mobileLinks.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                style={{ fontSize: 15, fontWeight: 300, color: 'var(--deep)', padding: '10px 0', letterSpacing: '0.04em' }}>
                {l.name}
              </Link>
            ))}
            <div style={{ height: 1, width: '100%', background: 'var(--sand)', margin: '24px 0 20px' }} />
            <Link href="/track-order" onClick={() => setMenuOpen(false)}
              style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--taupe)', padding: '10px 0' }}>
              Track Order
            </Link>
            <Link href="/faq" onClick={() => setMenuOpen(false)}
              style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--taupe)', padding: '10px 0' }}>
              FAQ & Help
            </Link>
          </div>
        </div>
      )}

      <style>{`
        /* ── 导航栏布局 ── */
        .site-nav {
          padding-left: clamp(28px, 5vw, 60px) !important;
          padding-right: clamp(28px, 5vw, 60px) !important;
        }

        /* ── 品牌区域 ── */
        .nav-brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; z-index: 101; flex-shrink: 0;
        }
        .nav-logo {
          height: 34px; width: 34px; border-radius: 50%;
          object-fit: cover; display: block;
          position: relative; top: 0px;
        }
        .nav-brand-text {
          font-family: var(--font-display);
          font-size: 16px; letter-spacing: 0.08em;
          text-transform: uppercase; font-weight: 300;
        }
        .nav-brand-text em {
          font-style: italic; font-weight: 300;
        }

        /* ── 导航链接 ── */
        .nav-links {
          display: flex; gap: 40px; list-style: none; margin: 0;
          position: absolute; left: 50%; transform: translateX(-50%);
          align-items: center;
        }
        .nav-link {
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          position: relative; padding-bottom: 2px;
        }
        .nav-link::after {
          content: ''; position: absolute; bottom: 0; left: 0;
          width: 0; height: 1px; background: var(--gold);
          transition: width 0.4s ease;
        }
        .nav-link:hover::after { width: 100%; }

        /* ── 图标组 ── */
        .nav-icons {
          display: flex; align-items: center;
          gap: clamp(12px, 2vw, 20px); z-index: 101;
        }
        .nav-icon-btn {
          background: none; border: none; cursor: pointer;
          padding: 6px; display: flex; align-items: center;
          -webkit-tap-highlight-color: transparent;
        }

        /* ── 搜索面板 ── */
        .search-panel {
          position: fixed; top: 0; left: 0; right: 0; z-index: 99;
          background: var(--cream);
          border-bottom: 1px solid var(--sand);
          padding-top: 72px;
          animation: slideDown 0.25s ease;
        }
        .search-inner {
          max-width: 640px; margin: 0 auto;
          padding: 20px clamp(24px, 5vw, 60px) 24px;
        }
        .search-input-wrap {
          display: flex; align-items: center; gap: 12;
          border-bottom: 1px solid var(--warm);
          padding-bottom: 14px; margin-bottom: 8px;
        }
        .search-input {
          flex: 1; background: none; border: none; outline: none;
          font-family: var(--font-body); font-size: 16px;
          color: var(--ink); letter-spacing: 0.03em;
        }
        .search-input::placeholder { color: var(--warm); }
        .search-results {
          max-height: 400px; overflow-y: auto;
        }
        .search-result-item {
          display: flex; align-items: center; gap: 14;
          width: 100%; padding: 12px 0;
          border-bottom: 1px solid var(--mist);
          background: none; border-left: none; border-right: none; border-top: none;
          cursor: pointer; transition: opacity 0.2s;
        }
        .search-result-item:hover { opacity: 0.7; }
        .search-result-img {
          width: 48px; height: 48px; border-radius: 4px;
          background: var(--sand); flex-shrink: 0; overflow: hidden;
        }

        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

        /* ── 响应式 ── */
        @media (max-width: 900px) {
          .nav-desktop { display: none !important; }
          .nav-links { position: static; transform: none; }
        }
        @media (min-width: 901px) {
          .nav-mobile { display: none !important; }
        }
        @media (max-width: 480px) {
          .nav-brand-text { font-size: 14px; }
          .nav-logo { height: 32px; width: 32px; }
        }
      `}</style>
    </>
  )
}
