'use client'
import { useState } from 'react'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) return
    setStatus('sending')
    try {
      // Simple mailto fallback — replace with your email API (Resend / Formspree etc.) later
      const mailtoLink = `mailto:hello@onesilkribbon.com?subject=${encodeURIComponent(form.subject || 'Website Enquiry — ' + form.name)}&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`
      window.location.href = mailtoLink
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Hero */}
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 60px 0' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>Get In Touch</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 42px, fontWeight: 300, color: 'var(--ink)', lineHeight: 1.12, marginBottom: 20 }}>Contact Us</h1>
          <p style={{ fontSize: 13, lineHeight: 2.1, color: 'var(--taupe)', marginBottom: 56, paddingBottom: 48, borderBottom: '1px solid var(--sand)' }}>
            We would love to hear from you — whether you have a question about an order, need help choosing a ribbon, or are interested in a bespoke commission. We aim to respond within 2 working days.
          </p>
        </div>

        {/* Two columns: form + info */}
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 60px 120px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }} className="contact-grid">

          {/* Form */}
          <div>
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Your Name</label>
              <input className="field-input" name="name" value={form.name} onChange={handleChange} placeholder="Jane Smith" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Email Address</label>
              <input className="field-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="jane@example.com" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Subject <span style={{ color: 'var(--warm)' }}>(optional)</span></label>
              <input className="field-input" name="subject" value={form.subject} onChange={handleChange} placeholder="Order enquiry, bespoke order…" />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label className="field-label">Message</label>
              <textarea className="field-input" name="message" value={form.message} onChange={handleChange}
                placeholder="Tell us how we can help…"
                style={{ minHeight: 140, resize: 'vertical' }} />
            </div>

            <button onClick={handleSubmit} disabled={status === 'sending'} style={{
              width: '100%', height: 50,
              background: status === 'sent' ? 'var(--gold)' : 'var(--ink)',
              color: '#fff', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: status === 'sending' ? 'wait' : 'pointer',
              transition: 'background .28s',
            }}>
              {status === 'sending' ? 'Opening…' : status === 'sent' ? '✓  Message Ready' : 'Send Message'}
            </button>
            {status === 'sent' && (
              <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 12, lineHeight: 1.8 }}>
                Your email client should have opened with your message pre-filled. If not, email us directly at <a href="mailto:hello@onesilkribbon.com" style={{ color: 'var(--gold)' }}>hello@onesilkribbon.com</a>.
              </p>
            )}
          </div>

          {/* Info panel */}
          <div style={{ paddingTop: 4 }}>
            {[
              { label: 'Email', value: 'hello@onesilkribbon.com', href: 'mailto:hello@onesilkribbon.com' },
              { label: 'Response Time', value: 'Within 2 working days' },
              { label: 'Order Enquiries', value: 'Please have your order number ready' },
              { label: 'Bespoke & Wholesale', value: 'We welcome custom and trade enquiries' },
            ].map(({ label, value, href }) => (
              <div key={label} style={{ padding: '18px 0', borderBottom: '1px solid var(--sand)' }}>
                <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 6 }}>{label}</p>
                {href
                  ? <a href={href} style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none' }}>{value}</a>
                  : <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{value}</p>
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        h1 { font-size: 42px !important; }
        .contact-grid { }
        .field-label {
          display: block;
          font-size: 9px; letter-spacing: .22em; text-transform: uppercase;
          color: var(--taupe); margin-bottom: 8px;
        }
        .field-input {
          width: 100%; padding: 12px 14px;
          background: var(--cream); border: 1px solid var(--warm);
          font-family: var(--font-body); font-size: 12px; font-weight: 300;
          color: var(--ink); outline: none;
          transition: border-color .2s;
        }
        .field-input:focus { border-color: var(--ink); }
        .field-input::placeholder { color: var(--warm); }
        @media(max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; padding: 0 24px 80px !important; }
        }
      `}</style>
    </>
  )
}
