'use client'
import { useState } from 'react'

export default function Bespoke() {
  const [form, setForm] = useState({ name: '', email: '', occasion: '', colours: '', width: '', length: '', notes: '' })
  const [sent, setSent] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = () => {
    if (!form.name || !form.email) return
    const body = Object.entries(form).map(([k, v]) => `${k}: ${v}`).join('\n')
    const subject = `Bespoke Enquiry — ${form.name}`
    window.location.href = `mailto:hello@onesilkribbon.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Hero */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Bespoke</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)', maxWidth: 600 }}>
            Something made<br /><em>only for you.</em>
          </h1>
        </div>

        {/* Intro + form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: 1360, margin: '0 auto', padding: '80px 60px 100px', gap: 80, alignItems: 'start' }} className="bespoke-grid">

          {/* Left — info */}
          <div>
            <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 20 }}>
              We welcome bespoke commissions for weddings, special occasions, editorial shoots, and corporate gifting. Whether you need a specific colourway, a custom width, or a particular length cut for an event — we would love to help.
            </p>
            <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 48 }}>
              Tell us what you have in mind using the form, and we will be in touch within 3 working days with a quote and timeline.
            </p>

            {[
              { label: 'Minimum Order', value: '10 metres per colourway' },
              { label: 'Lead Time', value: '2–4 weeks depending on specification' },
              { label: 'Colour Matching', value: 'We can work from Pantone references or fabric swatches' },
              { label: 'Widths Available', value: '4mm, 7mm, 10mm, 15mm, 25mm, 38mm' },
              { label: 'Enquiries', value: 'hello@onesilkribbon.com' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--sand)', fontSize: 12 }}>
                <span style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--taupe)' }}>{label}</span>
                <span style={{ color: 'var(--ink)', textAlign: 'right', maxWidth: 260 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Right — form */}
          <div>
            <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 28 }}>Enquiry Form</p>

            {[
              { name: 'name', label: 'Your Name', placeholder: 'Jane Smith' },
              { name: 'email', label: 'Email Address', placeholder: 'jane@example.com' },
              { name: 'occasion', label: 'Occasion / Project', placeholder: 'Wedding, editorial, corporate gift…' },
              { name: 'colours', label: 'Colour Ideas', placeholder: 'Dusty rose, ivory, Pantone 182 C…' },
              { name: 'width', label: 'Width Preference', placeholder: '10mm, 25mm, unsure…' },
              { name: 'length', label: 'Approximate Length', placeholder: '50 metres, 200 metres…' },
            ].map(({ name, label, placeholder }) => (
              <div key={name} style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 8 }}>{label}</label>
                <input name={name} value={form[name]} onChange={handleChange} placeholder={placeholder}
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--warm)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--ink)', outline: 'none' }} />
              </div>
            ))}

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 8 }}>Additional Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange}
                placeholder="Any other details — packaging, labelling, deadlines…"
                style={{ width: '100%', minHeight: 100, padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--warm)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--ink)', outline: 'none', resize: 'vertical' }} />
            </div>

            <button onClick={handleSubmit} style={{
              width: '100%', height: 50, background: sent ? 'var(--gold)' : 'var(--ink)', color: '#fff', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'background .28s',
            }}>
              {sent ? '✓  Enquiry Ready to Send' : 'Submit Enquiry'}
            </button>
            {sent && <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 12, lineHeight: 1.8 }}>Your email client should have opened. If not, email us directly at <a href="mailto:hello@onesilkribbon.com" style={{ color: 'var(--gold)' }}>hello@onesilkribbon.com</a>.</p>}
          </div>
        </div>

      </div>

      <style>{`
        @media(max-width: 900px) {
          .bespoke-grid { grid-template-columns: 1fr !important; padding: 48px 24px 80px !important; gap: 48px !important; }
          h1 { font-size: 36px !important; }
        }
        input:focus, textarea:focus { border-color: var(--ink) !important; }
        input::placeholder, textarea::placeholder { color: var(--warm); }
      `}</style>
    </>
  )
}
