'use client'
import { useState } from 'react'

export default function Bespoke() {
  const [tab, setTab] = useState('bespoke') // 'bespoke' | 'wholesale'
  const [form, setForm] = useState({ name: '', email: '', company: '', occasion: '', colours: '', width: '', length: '', notes: '' })
  const [sent, setSent] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = () => {
    if (!form.name || !form.email) return
    const subject = tab === 'bespoke'
      ? `Bespoke Enquiry — ${form.name}`
      : `Wholesale Enquiry — ${form.name}${form.company ? ' / ' + form.company : ''}`
    const body = Object.entries(form)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    window.location.href = `mailto:hello@onesilkribbon.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  const bespokeSpecs = [
    { label: 'Minimum Order', value: '10 metres per colourway' },
    { label: 'Lead Time', value: '2–4 weeks depending on specification' },
    { label: 'Colour Matching', value: 'Pantone references or fabric swatches welcome' },
    { label: 'Widths Available', value: '4mm, 7mm, 10mm, 15mm, 25mm, 38mm' },
    { label: 'Enquiries', value: 'hello@onesilkribbon.com' },
  ]

  const wholesaleSpecs = [
    { label: 'Who We Work With', value: 'Florists, stylists, boutiques, event planners, brands' },
    { label: 'Minimum Order', value: 'From £250 per order' },
    { label: 'Pricing', value: 'Trade pricing available on request' },
    { label: 'Lead Time', value: '1–2 weeks for stock items' },
    { label: 'Enquiries', value: 'hello@onesilkribbon.com' },
  ]

  const specs = tab === 'bespoke' ? bespokeSpecs : wholesaleSpecs

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Hero */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 0', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Trade & Custom</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)', maxWidth: 600, marginBottom: 48 }}>
            Bespoke &amp;<br /><em>Wholesale.</em>
          </h1>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {[['bespoke', 'Bespoke Orders'], ['wholesale', 'Wholesale & Trade']].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setSent(false) }} style={{
                padding: '14px 32px', background: 'none', border: 'none',
                borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
                fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '.22em',
                textTransform: 'uppercase', color: tab === id ? 'var(--ink)' : 'var(--taupe)',
                cursor: 'pointer', transition: 'color .2s', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: 1360, margin: '0 auto', padding: '72px 60px 100px', gap: 80, alignItems: 'start' }} className="bespoke-grid">

          {/* Left — info */}
          <div>
            {tab === 'bespoke' ? (
              <>
                <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 20 }}>
                  We welcome bespoke commissions for weddings, special occasions, editorial shoots, and gifting. Whether you need a specific colourway, a custom width, or a particular length — we would love to help bring your vision to life.
                </p>
                <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 40 }}>
                  Fill in the form and we will be in touch within 3 working days with a quote and timeline.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 20 }}>
                  We supply florists, stylists, boutiques, event planners and brands across the UK and Europe. Our trade programme offers competitive pricing, priority fulfilment, and access to our full range.
                </p>
                <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 40 }}>
                  Tell us about your business and requirements, and we will send you our wholesale information pack within 2 working days.
                </p>
              </>
            )}

            {specs.map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--sand)', fontSize: 12 }}>
                <span style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--taupe)' }}>{label}</span>
                <span style={{ color: 'var(--ink)', textAlign: 'right', maxWidth: 260, lineHeight: 1.7 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Right — form */}
          <div>
            <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 28 }}>
              {tab === 'bespoke' ? 'Bespoke Enquiry' : 'Wholesale Enquiry'}
            </p>

            {[
              { name: 'name', label: 'Your Name', placeholder: 'Jane Smith' },
              { name: 'email', label: 'Email Address', placeholder: 'jane@example.com' },
              ...(tab === 'wholesale' ? [{ name: 'company', label: 'Business Name', placeholder: 'Studio Bloom Floristry' }] : []),
              ...(tab === 'bespoke' ? [
                { name: 'occasion', label: 'Occasion / Project', placeholder: 'Wedding, editorial, gift…' },
                { name: 'colours', label: 'Colour Ideas', placeholder: 'Dusty rose, ivory, Pantone 182 C…' },
                { name: 'width', label: 'Width Preference', placeholder: '10mm, 25mm, unsure…' },
                { name: 'length', label: 'Approximate Length', placeholder: '50 metres, 200 metres…' },
              ] : [
                { name: 'occasion', label: 'Type of Business', placeholder: 'Florist, boutique, brand…' },
                { name: 'length', label: 'Estimated Monthly Volume', placeholder: '100m, 500m…' },
              ]),
            ].map(({ name, label, placeholder }) => (
              <div key={name} style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 8 }}>{label}</label>
                <input name={name} value={form[name]} onChange={handleChange} placeholder={placeholder}
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--warm)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--ink)', outline: 'none' }} className="form-input" />
              </div>
            ))}

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 8 }}>Additional Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange}
                placeholder={tab === 'bespoke' ? 'Packaging, labelling, deadlines…' : 'Any other details about your requirements…'}
                style={{ width: '100%', minHeight: 100, padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--warm)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--ink)', outline: 'none', resize: 'vertical' }} className="form-input" />
            </div>

            <button onClick={handleSubmit} style={{
              width: '100%', height: 50,
              background: sent ? 'var(--gold)' : 'var(--ink)',
              color: '#fff', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'background .28s',
            }}>
              {sent ? '✓  Enquiry Ready to Send' : 'Submit Enquiry'}
            </button>

            {sent && (
              <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 12, lineHeight: 1.8 }}>
                Your email client should have opened. If not, email us directly at{' '}
                <a href="mailto:hello@onesilkribbon.com" style={{ color: 'var(--gold)' }}>hello@onesilkribbon.com</a>.
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .form-input:focus { border-color: var(--ink) !important; }
        .form-input::placeholder { color: var(--warm); }
        @media(max-width: 900px) {
          .bespoke-grid { grid-template-columns: 1fr !important; padding: 48px 24px 80px !important; gap: 48px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </>
  )
}
