'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { useAuth } from '@osr/core/lib/auth'
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock'
import { shopGroupsFor } from '@/lib/storefront-nav'

export function Navbar({ fabricAvailable = false } = {}) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchRetry, setSearchRetry] = useState(0)
  const [shopOpen, setShopOpen] = useState(false)
  const searchInputRef = useRef(null)
  const accountRef = useRef(null)
  const navRef = useRef(null)
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const megaRef = useRef(null)
  const shopTriggerRef = useRef(null)
  const shopWasOpen = useRef(false)
  const pathname = usePathname()
  const router = useRouter()

  const { toggleCart, getItemCount, isOpen: cartOpen } = useCart()
  const { user, loading, signOut } = useAuth()
  const itemCount = getItemCount ? getItemCount() : 0

  const isShopActive = pathname.startsWith('/collections')
  const groups = shopGroupsFor(fabricAvailable)

  const closeAll = useCallback(() => {
    setShopOpen(false)
    setMenuOpen(false)
    setSearchOpen(false)
    setAccountOpen(false)
  }, [])

  useBodyScrollLock(menuOpen || searchOpen)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!cartOpen) return
    closeAll()
  }, [cartOpen, closeAll])

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 961px)')
    const onChange = () => {
      setMenuOpen(false)
      setShopOpen(false)
    }
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if ((!menuOpen && !searchOpen) || cartOpen) return
    const nav = navRef.current
    const panel = searchOpen ? searchRef.current : menuRef.current
    const previous = document.activeElement
    const selector = 'a[href], button:not([disabled]), input:not([disabled])'
    const visible = element => {
      if (!element || element.getClientRects().length === 0) return false
      if (typeof element.closest === 'function' && element.closest('[inert]')) return false
      return true
    }
    const controls = () => [nav, panel].flatMap(root =>
      [...(root?.querySelectorAll(selector) || [])].filter(visible)
    )
    const belongs = element => nav?.contains(element) || panel?.contains(element)
    panel?.querySelector(searchOpen ? 'input' : 'a[href]')?.focus({ preventScroll: true })
    const trapTab = event => {
      if (event.key !== 'Tab' || event.defaultPrevented) return
      const elements = controls()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first) return
      if (event.shiftKey && (document.activeElement === first || !belongs(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !belongs(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapTab)
    return () => {
      document.removeEventListener('keydown', trapTab)
      if (previous?.isConnected && (panel?.contains(document.activeElement) || document.activeElement === document.body)) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [menuOpen, searchOpen, cartOpen])

  useEffect(() => {
    if (!shopOpen) {
      if (!shopWasOpen.current) return
      shopWasOpen.current = false
      shopTriggerRef.current?.focus({ preventScroll: true })
      return
    }
    shopWasOpen.current = true
    const frame = window.requestAnimationFrame(() => {
      megaRef.current?.querySelector('a[href], button')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [shopOpen])

  useEffect(() => {
    closeAll()
  }, [pathname, closeAll])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      closeAll()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeAll])

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
    if (!searchOpen) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [searchOpen])

  useEffect(() => {
    const query = searchQuery.trim()
    setSearchResults([])
    setSearchError('')
    if (!searchOpen || query.length < 2 || query.length > 100) {
      setSearching(false)
      return
    }
    const controller = new AbortController()
    let active = true
    let deadline
    setSearching(true)
    const timer = setTimeout(async () => {
      deadline = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Search unavailable')
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Search unavailable')
        if (active) setSearchResults(data)
      } catch {
        if (active) {
          setSearchResults([])
          setSearchError('Search is unavailable right now. Please try again.')
        }
      } finally {
        clearTimeout(deadline)
        if (active) setSearching(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
      clearTimeout(deadline)
      controller.abort()
    }
  }, [searchQuery, searchOpen, searchRetry])

  useEffect(() => {
    const handler = event => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchClick = (collection, slug) => {
    setSearchOpen(false)
    router.push(`/collections/${collection}/${slug}`)
  }

  const handleSignOut = async () => {
    setAccountOpen(false)
    await signOut()
  }

  const getInitial = () => {
    if (!user) return ''
    if (user.name) return user.name.charAt(0).toUpperCase()
    if (user.email) return user.email.charAt(0).toUpperCase()
    return '?'
  }

  const directLinks = [
    { href: '/about', label: 'About' },
    { href: '/bespoke', label: 'Bespoke' },
    { href: '/journal', label: 'Journal' },
  ]

  return (
    <>
      <nav ref={navRef} className={`site-nav osr-nav is-solid ${scrolled ? 'is-scrolled' : ''}`} aria-label="Main navigation">
        <Link href="/" onClick={closeAll} className="osr-brand">
          <Image
            src="/images/logo.png"
            alt="One Silk Ribbon"
            width={30}
            height={30}
            loading="eager"
            className="osr-brand-logo"
          />
          <span className="osr-brand-text">
            One <em>Silk</em> Ribbon
          </span>
        </Link>

        <div className="osr-desktop-nav">
          <button
            ref={shopTriggerRef}
            type="button"
            className={`osr-shop-trigger ${isShopActive ? 'is-active' : ''}`}
            aria-expanded={shopOpen}
            aria-controls="osr-mega"
            aria-current={isShopActive ? 'page' : undefined}
            onClick={() => {
              setShopOpen(value => !value)
              setMenuOpen(false)
              setSearchOpen(false)
              setAccountOpen(false)
            }}
          >
            Shop <span className="osr-chevron" aria-hidden="true">⌄</span>
          </button>
          {directLinks.map(link => {
            const active = pathname.startsWith(link.href)
            return (
              <Link key={link.href} href={link.href} className={`osr-nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="osr-nav-tools">
          <button
            type="button"
            className="osr-icon-btn"
            aria-label="Search"
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen(value => !value)
              setShopOpen(false)
              setMenuOpen(false)
              setAccountOpen(false)
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {!loading && (
            <div className="osr-desktop-account" ref={accountRef} style={{ position: 'relative' }}>
              {user ? (
                <button
                  type="button"
                  onClick={() => setAccountOpen(value => !value)}
                  className="osr-icon-btn"
                  aria-label="My account"
                  aria-expanded={accountOpen}
                  style={{ padding: 4 }}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || user.email}
                      width={28}
                      height={28}
                      decoding="async"
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '1.5px solid var(--osr-gold)' }}
                    />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--osr-gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 400 }}>
                      {getInitial()}
                    </div>
                  )}
                </button>
              ) : (
                <Link href="/login" className="osr-icon-btn" aria-label="Sign in" style={{ display: 'flex', padding: 6 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </Link>
              )}

              {user && accountOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 220, background: 'var(--osr-paper)', border: '1px solid var(--osr-line)', boxShadow: '0 8px 32px rgba(28,23,20,0.10)', zIndex: 200, animation: 'osrFade 0.18s ease' }}>
                  <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--osr-line-soft)' }}>
                    <p style={{ fontSize: 13, color: 'var(--osr-ink)', fontWeight: 400, marginBottom: 2 }}>{user.name || 'My Account'}</p>
                    <p style={{ fontSize: 11, color: 'var(--osr-muted)', wordBreak: 'break-all' }}>{user.email}</p>
                  </div>
                  {[
                    { href: '/account', label: 'My Account' },
                    { href: '/account/orders', label: 'My Orders' },
                    { href: '/account/addresses', label: 'Saved Addresses' },
                    { href: '/account/profile', label: 'Edit Profile' },
                  ].map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAccountOpen(false)}
                      style={{ display: 'block', padding: '10px 16px', fontSize: 12, color: 'var(--osr-ink-soft)', letterSpacing: '.03em', borderBottom: '1px solid var(--osr-line-soft)' }}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 11, color: 'var(--osr-muted)', letterSpacing: '.08em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              setSearchOpen(false)
              setShopOpen(false)
              setAccountOpen(false)
              toggleCart()
            }}
            className="osr-icon-btn"
            aria-label="Basket"
            style={{ position: 'relative' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {itemCount > 0 && <span className="osr-bag-count">{itemCount}</span>}
          </button>

          <button
            type="button"
            className={`osr-burger ${menuOpen ? 'is-open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="osr-mobile-menu"
            onClick={() => {
              setMenuOpen(value => !value)
              setSearchOpen(false)
              setShopOpen(false)
              setAccountOpen(false)
            }}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <div className={`osr-mega-scrim ${shopOpen ? 'is-open' : ''}`} onClick={() => setShopOpen(false)} aria-hidden="true" />
      <div
        ref={megaRef}
        className={`osr-mega ${shopOpen ? 'is-open' : ''}`}
        id="osr-mega"
        aria-label="Shop menu"
        inert={!shopOpen}
        aria-hidden={!shopOpen}
      >
        <div className={`osr-mega-inner ${groups.length > 3 ? 'has-fabric' : ''}`}>
          {groups.map(group => (
            <div key={group.id} className="osr-mega-group">
              <Link href={group.href} onClick={() => setShopOpen(false)}>
                {group.label} <span>{group.note}</span>
              </Link>
              <ul className="osr-mega-list">
                {group.links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={() => setShopOpen(false)}>
                      <strong>{link.label}</strong>
                      <small>{link.note}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link href="/collections/hand-frayed-silk-ribbons" className="osr-mega-tile" onClick={() => setShopOpen(false)}>
            <Image src="/images/silk-gallery/hero-desktop.jpg" alt="Pearl White hand-frayed silk ribbon on a vintage wooden spool" fill sizes="280px" style={{ objectFit: 'cover' }} />
            <div className="osr-mega-tile-body">
              <h3>The Ribbon House</h3>
              <p>Pearl White · hand-torn crêpe satin</p>
            </div>
          </Link>
        </div>
        <div className="osr-mega-foot">
          <Link className="osr-textlink" href="/collections" onClick={() => setShopOpen(false)}>Browse all collections</Link>
        </div>
      </div>

      <div
        ref={menuRef}
        className={`osr-mobile-menu ${menuOpen ? 'is-open' : ''}`}
        id="osr-mobile-menu"
        role="dialog"
        aria-modal={menuOpen ? 'true' : undefined}
        aria-label="Mobile navigation"
        inert={!menuOpen}
        aria-hidden={!menuOpen}
      >
        <div className="osr-mobile-top">
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/collections" onClick={() => setMenuOpen(false)}>Shop all collections</Link>
        </div>

        {groups.map((group, index) => (
          <MobileGroup key={group.id} group={group} index={index} onNavigate={() => setMenuOpen(false)} />
        ))}

        <div className="osr-mobile-footer">
          <Link href="/about" onClick={() => setMenuOpen(false)}>Our Story</Link>
          <Link href="/bespoke" onClick={() => setMenuOpen(false)}>Bespoke &amp; Trade</Link>
          <Link href="/journal" onClick={() => setMenuOpen(false)}>Journal</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
          <Link href="/track-order" onClick={() => setMenuOpen(false)}>Track Order</Link>
          <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ &amp; Help</Link>
          {user ? (
            <>
              <Link href="/account" onClick={() => setMenuOpen(false)}>My Account</Link>
              <Link href="/account/orders" onClick={() => setMenuOpen(false)}>My Orders</Link>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); signOut() }}
                style={{ textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setMenuOpen(false)}>Sign in / Register</Link>
          )}
        </div>
      </div>

      {searchOpen && (
        <>
          <div className="osr-search-scrim" onClick={() => setSearchOpen(false)} />
          <div ref={searchRef} className="osr-search-panel" role="search" aria-label="Product search">
            <div className="osr-search-inner">
              <div className="osr-search-input-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--osr-muted)" strokeWidth="1.4" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="search"
                  aria-label="Search products"
                  maxLength={100}
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search products…"
                  className="osr-search-input"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setSearchOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--osr-muted)', fontSize: 18, cursor: 'pointer', padding: 4, minWidth: 44, minHeight: 44, lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
              <div className="osr-search-results" aria-live="polite" aria-busy={searching}>
                {searching && <p style={{ padding: '20px 0', fontSize: 12, color: 'var(--osr-muted)', textAlign: 'center' }}>Searching…</p>}
                {searchError && (
                  <div role="alert" style={{ padding: '16px 0', fontSize: 13, color: 'var(--osr-ink)' }}>
                    <p>{searchError}</p>
                    <button type="button" className="osr-textlink" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => setSearchRetry(value => value + 1)}>
                      Retry search
                    </button>
                  </div>
                )}
                {!searching && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--osr-muted)', textAlign: 'center' }}>
                    No products found for &quot;{searchQuery}&quot;
                  </p>
                )}
                {searchResults.map(product => {
                  const image = Array.isArray(product.images) ? product.images[0] : null
                  return (
                    <button key={product.id} type="button" onClick={() => handleSearchClick(product.collection, product.slug)} className="osr-search-result">
                      <div className="osr-search-result-img">
                        {image ? <img src={image} alt={product.name} loading="lazy" decoding="async" /> : null}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, color: 'var(--osr-ink)', marginBottom: 3, textAlign: 'left' }}>{product.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--osr-muted)', letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'left' }}>
                          {(product.collection || '').replace(/-/g, ' ')}
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
    </>
  )
}

function MobileGroup({ group, index, onNavigate }) {
  const [open, setOpen] = useState(false)
  const panelId = `osr-mobile-group-${index}`
  return (
    <div className={`osr-mobile-group ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="osr-mobile-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
      >
        <span>
          {group.label}
          <small>{group.note}</small>
        </span>
        <span className="osr-mobile-plus" aria-hidden="true" />
      </button>
      <div className="osr-mobile-links" id={panelId} inert={!open} aria-hidden={!open}>
        <div>
          <ul>
            <li>
              <Link href={group.href} onClick={onNavigate}>
                All {group.label}
                <small>View the collection</small>
              </Link>
            </li>
            {group.links.map(link => (
              <li key={link.href}>
                <Link href={link.href} onClick={onNavigate}>
                  {link.label}
                  <small>{link.note}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
