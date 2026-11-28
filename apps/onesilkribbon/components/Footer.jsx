'use client'

import Link from 'next/link'
import { useState } from 'react'
import { footerShopLinksFor } from '@/lib/storefront-nav'

const SOCIAL_LINKS = [
  { label: 'Ig', href: 'https://www.instagram.com/onesilkribbon' },
  { label: 'Pt', href: 'https://pin.it/4xnOTKJUY' },
  { label: 'Tk', href: 'https://www.tiktok.com/@miaowsilkribbons' },
  { label: 'Fb', href: 'https://www.facebook.com/profile.php?id=61586481380538' },
]

export function Footer({ fabricAvailable = false }) {
  return (
    <footer className="site-footer osr-footer">
      <div className="osr-footer-inner">
        <div className="osr-footer-grid">
          <div className="osr-footer-brand-col">
            <Link href="/" className="osr-footer-brand">
              One <em>Silk</em> Ribbon
            </Link>
            <p className="osr-footer-tagline">
              &apos;Silk ribbons and carefully chosen materials, made to last.&apos;
            </p>
            <div className="osr-footer-social">
              {SOCIAL_LINKS.map(social => (
                <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <FooterCol title="Shop" links={footerShopLinksFor(fabricAvailable)} />

          <FooterCol
            title="Studio"
            links={[
              { label: 'Our Story', href: '/about' },
              { label: 'Bespoke & Wholesale', href: '/bespoke' },
              { label: 'Journal', href: '/journal' },
              { label: 'Choosing Silk Ribbon', href: '/ribbon-guide' },
            ]}
          />

          <FooterCol
            title="Support"
            links={[
              { label: 'Shipping & Returns', href: '/shipping-returns' },
              { label: 'Track Your Order', href: '/track-order' },
              { label: 'Silk Care Guide', href: '/care-guide' },
              { label: 'Contact Us', href: '/contact' },
              { label: 'FAQ', href: '/faq' },
            ]}
          />
        </div>

        <div className="osr-footer-bottom">
          <p>© {new Date().getFullYear()} One Silk Ribbon. All rights reserved. · VAT Registered</p>
          <div className="osr-footer-legal">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookies">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="osr-footer-col">
      <h3 className="osr-footer-col-title">{title}</h3>
      <button type="button" className="osr-footer-col-header" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span>{title}</span>
        <span aria-hidden="true" style={{ color: 'var(--osr-muted)', fontSize: 14, transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      <div className={`osr-footer-col-collapse ${open ? 'is-open' : ''}`}>
        <ul>
          {links.map(link => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
