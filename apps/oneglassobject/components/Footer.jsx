'use client'
import { COLLECTIONS } from '@/config/site'
import Link from 'next/link'
import { useState } from 'react'

export function Footer() {
  const collections = [
    ...COLLECTIONS,
  ]

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        {/* Brand */}
        <div className="footer-brand">
          <Link href="/" style={{
            fontFamily: 'var(--font-display)', fontSize: 20,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--cream)', display: 'block', marginBottom: 20,
          }}>
            One <em style={{ fontStyle: 'italic', fontWeight: 300 }}>Silk</em> Ribbon
          </Link>
          <p className="footer-tagline" style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic',
            color: 'var(--taupe)', lineHeight: 1.8, maxWidth: 260,
          }}>
            &apos;Hand-blown glass objects for everyday rituals.&apos;
          </p>
          {/* Social */}
          <div className="footer-social" style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {[
              { label: 'Ig', href: 'https://www.instagram.com/oneglassobject' },
              { label: 'Pt', href: 'https://pin.it/4xnOTKJUY' },
              { label: 'Tk', href: 'https://www.tiktok.com/@oneglassobject' },
              { label: 'Fb', href: 'https://www.facebook.com/profile.php?id=61586481380538' },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                style={{
                  width: 36, height: 36, border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 11, color: 'var(--warm)',
                  transition: 'border-color 0.3s, color 0.3s',
                }} className="social-link">
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* Collections */}
        <FooterCol title="Collections" links={collections.map(c => ({
          label: c.name, href: `/collections/${c.slug}`
        }))} />

        {/* Studio */}
        <FooterCol title="Studio" links={[
          { label: 'Our Story',           href: '/about' },
          { label: 'Bespoke',             href: '/bespoke' },
        ]} />

        {/* Support */}
        <FooterCol title="Support" links={[
          { label: 'Shipping & Returns', href: '/shipping-returns' },
          { label: 'Track Your Order',   href: '/track-order' },
          { label: 'Silk Care Guide',    href: '/care-guide' },
          { label: 'Contact Us',         href: '/contact' },
          { label: 'FAQ',                href: '/faq' },
        ]} />
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p style={{ fontSize: 11, color: 'var(--taupe)', letterSpacing: '0.08em' }}>
          © {new Date().getFullYear()} One Glass Object. All rights reserved.
          &nbsp;·&nbsp; VAT Registered
        </p>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms',          href: '/terms' },
            { label: 'Cookies',        href: '/cookies' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              fontSize: 11, color: 'var(--taupe)',
              letterSpacing: '0.08em', transition: 'color 0.3s',
            }} className="footer-legal-link">
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .site-footer {
          background: var(--ink);
          padding: 80px var(--page-padding, 60px) 40px;
          color: var(--warm);
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 60px;
          padding-bottom: 60px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .social-link:hover { border-color: var(--gold) !important; color: var(--gold) !important; }
        .footer-legal-link:hover { color: var(--gold) !important; }

        /* 手风琴收起/展开的高度动画：用 max-height 过渡。
           默认（桌面端）强制展开，折叠效果只在下面 600px 断点内生效 */
        .footer-col-collapse { max-height: none; overflow: hidden; transition: max-height 0.3s ease; }
        .footer-col-header { display: none; }

        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
          .footer-brand { grid-column: 1 / -1; }
        }
        @media (max-width: 600px) {
          .site-footer { padding: 48px 24px 32px; }
          .footer-grid { grid-template-columns: 1fr; gap: 8px; }
          .footer-brand { grid-column: auto; text-align: center !important; padding-bottom: 32px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .footer-tagline { margin: 0 auto !important; }
          .footer-social { justify-content: center !important; }
          .footer-bottom { flex-direction: column; align-items: center !important; text-align: center; }

          /* 手风琴只在手机上生效：标题变成可点击的按钮，链接列表默认收起 */
          .footer-col-header {
            display: flex; width: 100%; align-items: center; justify-content: space-between;
            background: none; border: none; padding: 18px 0; cursor: pointer;
            border-top: 1px solid rgba(255,255,255,0.08);
          }
          .footer-col-collapse { max-height: 0; }
          .footer-col-collapse.is-open { max-height: 400px; }
          .footer-col:last-child .footer-col-collapse-inner { padding-bottom: 4px; }
        }
      ` }} />
    </footer>
  )
}

function FooterCol({ title, links }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="footer-col">
      <h4 className="footer-col-static-title" style={{
        fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
        color: 'var(--cream)', marginBottom: 24,
      }}>
        {title}
      </h4>
      <button type="button" className="footer-col-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--cream)' }}>{title}</span>
        <span className="footer-col-chevron" aria-hidden="true" style={{ color: 'var(--taupe)', fontSize: 14, transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      <div className={`footer-col-collapse ${open ? 'is-open' : ''}`}>
        <div className="footer-col-collapse-inner">
          <ul style={{ listStyle: 'none' }}>
            {links.map(l => (
              <li key={l.href} style={{ marginBottom: 12 }}>
                <Link href={l.href} style={{
                  fontSize: 12, color: 'var(--taupe)',
                  letterSpacing: '0.04em', transition: 'color 0.3s',
                }} className="footer-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .footer-link:hover { color: var(--gold) !important; }
        @media (max-width: 600px) {
          .footer-col-static-title { display: none; }
          .footer-col-collapse-inner ul { padding-top: 4px; }
        }
      ` }} />
    </div>
  )
}
