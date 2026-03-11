'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/lib/cart'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const { items, isOpen, toggleCart, getItemCount } = useCart()
  const itemCount = getItemCount ? getItemCount() : 0

  // 判断当前页面是否有深色 Hero 背景（需要白色导航文字）
  const isDarkHero = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // 颜色逻辑：未滚动+深色Hero → 白色文字；其他情况 → 深色文字
  const isLight = isDarkHero && !scrolled && !menuOpen
  const textColor = isLight ? '#fff' : 'var(--deep)'
  const logoSrc = isLight ? '/images/logo-white.png' : '/images/logo.png'
  const iconStroke = isLight ? '#fff' : 'var(--deep)'

  // 桌面端导航链接（精简版）
  const navLinks = [
    { href: '/collections', label: 'Shop' },
    { href: '/about',       label: 'About' },
    { href: '/bespoke',     label: 'Bespoke' },
  ]

  // 移动端菜单链接
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
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? '10px 0' : '18px 0',
        paddingLeft: 'clamp(20px, 4vw, 60px)',
        paddingRight: 'clamp(20px, 4vw, 60px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled || menuOpen ? 'rgba(247,243,238,0.95)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--sand)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        {/* Logo + 品牌名 */}
        <Link href="/" onClick={() => setMenuOpen(false)} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          textDecoration: 'none', zIndex: 101,
        }}>
          <img
            src={logoSrc}
            alt="Silk Ribbon"
            style={{
              height: 38, width: 38, borderRadius: '50%',
              objectFit: 'cover', display: 'block',
              transition: 'opacity 0.3s',
            }}
          />
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 17,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: isLight ? '#fff' : 'var(--ink)',
            textShadow: isLight ? '0 1px 8px rgba(0,0,0,0.3)' : 'none',
            transition: 'color 0.4s, text-shadow 0.4s',
          }}>
            Silk Ribbon
          </span>
        </Link>

        {/* 桌面端导航链接 */}
        <ul style={{ display: 'flex', gap: 40, listStyle: 'none', margin: 0 }} className="nav-desktop">
          {navLinks.map(l => (
            <li key={l.href}>
              <Link href={l.href} style={{
                fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: textColor, position: 'relative', paddingBottom: 2,
                textShadow: isLight ? '0 1px 6px rgba(0,0,0,0.25)' : 'none',
                transition: 'color 0.4s, text-shadow 0.4s',
              }} className="nav-link">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* 右侧图标 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 2vw, 24px)', zIndex: 101 }}>
          {/* 购物车 */}
          <button onClick={toggleCart} style={{
            background: 'none', border: 'none', position: 'relative',
            display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 4,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={iconStroke} strokeWidth="1.3"
              style={{ transition: 'stroke 0.4s', filter: isLight ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' : 'none' }}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {itemCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--gold)', color: '#fff',
                width: 16, height: 16, borderRadius: '50%',
                fontSize: 9, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 400,
              }}>
                {itemCount}
              </span>
            )}
          </button>

          {/* 汉堡菜单（移动端） */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="nav-mobile"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
              stroke={menuOpen ? 'var(--ink)' : iconStroke} strokeWidth="1.3"
              style={{ transition: 'stroke 0.4s' }}>
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="18" y2="18"/>
                  <line x1="18" y1="4" x2="4" y2="18"/>
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="19" y2="7"/>
                  <line x1="3" y1="11" x2="19" y2="11"/>
                  <line x1="3" y1="15" x2="19" y2="15"/>
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* ── 移动端全屏菜单 ── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'var(--cream)', paddingTop: 80,
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
        .nav-link::after {
          content: ''; position: absolute; bottom: 0; left: 0;
          width: 0; height: 1px; background: var(--gold);
          transition: width 0.4s ease;
        }
        .nav-link:hover::after { width: 100%; }
        @media (max-width: 900px) { .nav-desktop { display: none !important; } }
        @media (min-width: 901px) { .nav-mobile { display: none !important; } }
      `}</style>
    </>
  )
}
