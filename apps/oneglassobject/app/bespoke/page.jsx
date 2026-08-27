'use client'
import { useState } from 'react'

export default function Bespoke() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name || !form.email) return
    setSent('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: `Bespoke & Wholesale Enquiry — ${form.name}`,
          message: form.message,
        }),
      })
      const data = await res.json()
      if (data.success) setSent('done')
      else setSent('error')
    } catch { setSent('error') }
  }

  const specs = [
    { label: 'Bespoke Minimum', value: 'No minimum' },
    { label: 'Wholesale Minimum', value: 'No minimum' },
    { label: 'Lead Time', value: 'Depends on your order' },
    { label: 'Enquiries', value: 'hello@oneglassobject.com' },
  ]

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Hero */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 48px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Trade & Custom</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)' }}>
            Bespoke &amp; <em>Wholesale.</em>
          </h1>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: 1360, margin: '0 auto', padding: '72px 60px 100px', gap: 80, alignItems: 'start' }} className="bespoke-grid">

          {/* Left — info */}
          <div>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 20 }}>
              We welcome enquiries for bespoke commissions — weddings, special occasions, editorial shoots and gifting — as well as wholesale and trade accounts for florists, stylists, boutiques and brands.
            </p>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 40 }}>
              Tell us what you&apos;re looking for and we will be in touch within a few working days with pricing and timeline.
            </p>

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
              Enquiry
            </p>

            {[
              { name: 'name', label: 'Your Name', placeholder: 'Company / Studio / Your Name' },
              { name: 'email', label: 'Email Address', placeholder: 'jane@example.com' },
            ].map(({ name, label, placeholder }) => (
              <div key={name} style={{ marginBottom: 18 }}>
                <label className="input-label">{label}</label>
                <input name={name} value={form[name]} onChange={handleChange} placeholder={placeholder}
                  className="input" style={{ fontFamily: 'var(--font-body)' }} />
              </div>
            ))}

            <div style={{ marginBottom: 28 }}>
              <label className="input-label">Your Requirements</label>
              <textarea name="message" value={form.message} onChange={handleChange}
                placeholder="Tell us what you're looking for"
                className="input" style={{ minHeight: 100, fontFamily: 'var(--font-body)', resize: 'vertical' }} />
            </div>

            <button onClick={handleSubmit} disabled={sent === 'loading' || sent === 'done'} style={{
              width: '100%', height: 50,
              background: sent === 'done' ? 'var(--gold)' : 'var(--ink)',
              color: '#fff', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: (sent === 'loading' || sent === 'done') ? 'not-allowed' : 'pointer',
              opacity: sent === 'loading' ? 0.7 : 1,
              transition: 'background .28s',
            }}>
              {sent === 'loading' ? 'Sending…' : sent === 'done' ? '✓  Enquiry Sent' : 'Submit Enquiry'}
            </button>

            {sent === 'done' && (
              <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 12, lineHeight: 1.8 }}>
                We&apos;ve received your enquiry and sent a confirmation to your email. If you don&apos;t see it, feel free to reach us directly at{' '}
                <a href="mailto:hello@oneglassobject.com" style={{ color: 'var(--gold)' }}>hello@oneglassobject.com</a>.
              </p>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media(max-width: 900px) {
          .bespoke-grid { grid-template-columns: 1fr !important; padding: 48px 24px 80px !important; gap: 48px !important; }
          h1 { font-size: 36px !important; }
        }
      ` }} />
    </>
  )
}
