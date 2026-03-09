'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  
  // 修复点：从 useCart 中解构 getItemCount 方法，并调用它获取 itemCount
  const { items, isOpen, toggleCart, getItemCount } = useCart()
  const itemCount = getItemCount ? getItemCount() : 0

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const collections = [
    { name: 'Fine Silk Ribbons',         slug: 'fine-silk-ribbons' },
    { name: 'Hand-Frayed',               slug: 'hand-frayed-silk-ribbons' },
    { name: 'Handcrafted Adornments',    slug: 'handcrafted-adornments' },
    { name: 'Patterned Ribbons',         slug: 'patterned-ribbons' },
    { name: 'Studio Tools',              slug: 'studio-tools' },
    { name: 'Vintage-Inspired',          slug: 'vintage-inspired-ribbons' },
  ]

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? '16px 60px' : '28px 60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(247,243,238,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--sand)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-display)', fontSize: 18,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/track-order" style={{
            fontSize: 11, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--deep)',
          }} className="nav-desktop">
            Track Order
          </Link>

          <button onClick={toggleCart} style={{
            background: 'none', border: 'none', position: 'relative',
            display: 'flex', alignItems: 'center', cursor: 'pointer',
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
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99,
          background: 'var(--cream)', paddingTop: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 8,
        }}>
          {collections.map(c => (
            <Link key={c.slug} href={`/collections/${c.slug}`}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300,
                color: 'var(--ink)', padding: '12px 0',
              }}>
                {c.name}
            </Link>
          ))}
          <div style={{ height: 1, width: 60, background: 'var(--warm)', margin: '16px 0' }} />
          <Link href="/track-order" onClick={() => setMenuOpen(false)}
            style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--taupe)' }}>
            Track Order
          </Link>
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
        nav { padding-left: clamp(24px, 4vw, 60px) !important; padding-right: clamp(24px, 4vw, 60px) !important; }
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
