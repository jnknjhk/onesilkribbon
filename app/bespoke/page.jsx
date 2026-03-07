export default function BespokePage() {
  return (
    <div style={{ paddingTop: 120, minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 600, padding: '0 40px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 300, color: 'var(--ink)', marginBottom: 24 }}>Bespoke Orders</h1>
        <p style={{ fontSize: 15, color: 'var(--taupe)', lineHeight: 1.9 }}>For custom widths, colours or large wedding orders, please get in touch.</p>
        <a href="mailto:hello@onesilkribbon.com" style={{ display: 'inline-block', marginTop: 32, padding: '14px 40px', background: 'var(--ink)', color: '#fff', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Contact Us
        </a>
      </div>
    </div>
  )
}
