import Link from 'next/link'

export function Footer() {
  const collections = [
    { name: 'Fine Silk Ribbons',       slug: 'fine-silk-ribbons' },
    { name: 'Hand-Frayed',             slug: 'hand-frayed-silk-ribbons' },
    { name: 'Handcrafted Adornments',  slug: 'handcrafted-adornments' },
    { name: 'Patterned Ribbons',       slug: 'patterned-ribbons' },
    { name: 'Studio Tools',            slug: 'studio-tools' },
    { name: 'Vintage-Inspired',        slug: 'vintage-inspired-ribbons' },
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
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic',
            color: 'var(--taupe)', lineHeight: 1.8, maxWidth: 260,
          }}>
            "Silk in its most natural form — hand-treated, botanically inspired, made to last."
          </p>
          {/* Social */}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {[
              { label: 'Ig', href: 'https://www.instagram.com/onesilkribbon' },
              { label: 'Pt', href: 'https://pin.it/4xnOTKJUY' },
              { label: 'Tk', href: 'https://www.tiktok.com/@miaowsilkribbons' },
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
          { label: 'The Palette',         href: '/palette' },
          { label: 'Bespoke & Wholesale', href: '/bespoke' },
          { label: 'Journal',             href: '/journal' },
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
          © {new Date().getFullYear()} One Silk Ribbon. All rights reserved.
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

      <style>{`
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

        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
          .footer-brand { grid-column: 1 / -1; }
        }
        @media (max-width: 600px) {
          .site-footer { padding: 48px 24px 32px; }
          .footer-grid { grid-template-columns: 1fr; gap: 32px; }
          .footer-brand { grid-column: auto; }
          .footer-bottom { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </footer>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 style={{
        fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
        color: 'var(--cream)', marginBottom: 24,
      }}>
        {title}
      </h4>
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
      <style>{`.footer-link:hover { color: var(--gold) !important; }`}</style>
    </div>
  )
}
