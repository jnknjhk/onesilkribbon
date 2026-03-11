'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  
  const { items, isOpen, toggleCart, getItemCount } = useCart()
  const itemCount = getItemCount ? getItemCount() : 0

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 锁定 body 滚动当菜单打开时
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const collections = [
    { name: 'Fine Silk Ribbons',         slug: 'fine-silk-ribbons' },
    { name: 'Hand-Frayed',               slug: 'hand-frayed-silk-ribbons' },
    { name: 'Handcrafted Adornments',    slug: 'handcrafted-adornments' },
    { name: 'Patterned Ribbons',         slug: 'patterned-ribbons' },
    { name: 'Studio Tools',              slug: 'studio-tools' },
    { name: 'Vintage-Inspired',          slug: 'vintage-inspired-ribbons' },
  ]

  const moreLinks = [
    { name: 'Our Story',       href: '/about' },
    { name: 'The Palette',     href: '/palette' },
    { name: 'Bespoke & Trade', href: '/bespoke' },
    { name: 'Journal',         href: '/journal' },
    { name: 'Contact',         href: '/contact' },
  ]

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? '14px 0' : '24px 0',
        paddingLeft: 'clamp(20px, 4vw, 60px)',
        paddingRight: 'clamp(20px, 4vw, 60px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled || menuOpen ? 'rgba(247,243,238,0.95)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--sand)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        <Link href="/" onClick={() => setMenuOpen(false)} style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 1.5vw, 18px)',
          letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)',
          zIndex: 101,
        }}>
          One <em style={{ fontStyle: 'italic', fontWeight: 300 }}>Silk</em> Ribbon
        </Link>

        <ul style={{ display: 'flex', gap: 44, listStyle: 'none', margin: 0 }}
          className="nav-desktop">
          {[
            { href: '/collections', label: 'Collections' },
            { href: '/palette', label: 'The Palette' },
            { href: '/about', label: 'Our Story' },
            { href: '/bespoke', label: 'Bespoke' },
            { href: '/journal', label: 'Journal' },
          ].map(l => (
            <li key={l.href}>
              <Link href={l.href} style={{
                fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'var(--deep)', position: 'relative', paddingBottom: 2,
              }} className="nav-link">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 2vw, 28px)', zIndex: 101 }}>
          <Link href="/track-order" style={{
            fontSize: 11, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--deep)',
          }} className="nav-desktop">
            Track Order
          </Link>

          <button onClick={toggleCart} style={{
            background: 'none', border: 'none', position: 'relative',
            display: 'flex', alignItems: 'center', cursor: 'pointer',
            padding: 4,
          }}>
            <CartIcon />
            {itemCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--gold)', color: '#fff',
                width: 16, height: 16, borderRadius: '50%',
                fontSize: 9, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 400,
              }}>
                {itemCount}
              </span>
            )}
          </button>

          <button onClick={() => setMenuOpen(!menuOpen)}
            className="nav-mobile"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
            }}>
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </nav>

      {/* ── 移动端全屏菜单 ── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'var(--cream)',
          paddingTop: 80,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ padding: '20px 32px 40px', display: 'flex', flexDirection: 'column' }}>
            {/* Collections */}
            <p style={{
              fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: 20, paddingBottom: 12,
              borderBottom: '1px solid var(--sand)',
            }}>Collections</p>
            {collections.map(c => (
              <Link key={c.slug} href={`/collections/${c.slug}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300,
                  color: 'var(--ink)', padding: '12px 0',
                  borderBottom: '1px solid var(--mist)',
                }}>
                  {c.name}
              </Link>
            ))}

            {/* More links */}
            <div style={{ height: 1, width: '100%', background: 'var(--sand)', margin: '24px 0 20px' }} />
            <p style={{
              fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: 16,
            }}>Explore</p>
            {moreLinks.map(l => (
              <Link key={l.href} href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontSize: 15, fontWeight: 300,
                  color: 'var(--deep)', padding: '10px 0',
                  letterSpacing: '0.04em',
                }}>
                  {l.name}
              </Link>
            ))}

            {/* Utility links */}
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

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="var(--deep)" strokeWidth="1.3">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )
}

function HamburgerIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
      stroke="var(--ink)" strokeWidth="1.3">
      {open ? (
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
  )
}
