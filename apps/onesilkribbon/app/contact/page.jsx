'use client'
import { useRef, useState } from 'react'

export default function Contact() {
  // website 是蜜罐字段（页面上藏起来，真人不会填），见 /api/contact
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')
  const submitting = useRef(false)

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    if (status === 'sent' || status === 'error') { setStatus('idle'); setErrorMsg('') }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting.current || status === 'sent') return
    const payload = { ...form, name: form.name.trim(), email: form.email.trim(), message: form.message.trim() }
    if (!payload.name || !payload.email || !payload.message) {
      setStatus('error')
      setErrorMsg('Please fill in your name, email address and message.')
      const missing = !payload.name ? 'name' : !payload.email ? 'email' : 'message'
      event.currentTarget.elements.namedItem(missing)?.focus()
      return
    }
    submitting.current = true
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) setStatus('sent')
      else { setStatus('error'); setErrorMsg(data.error || '') }
    } catch {
      setStatus('error')
    } finally { submitting.current = false }
  }

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Hero */}
        <div className="contact-hero" style={{ maxWidth: 780, margin: '0 auto', padding: '80px 60px 0' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>Get In Touch</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 300, color: 'var(--ink)', lineHeight: 1.12, marginBottom: 20 }}>Contact Us</h1>
          <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.1, color: 'var(--taupe)', marginBottom: 56, paddingBottom: 48, borderBottom: '1px solid var(--sand)' }}>
            We would love to hear from you — whether you have a question about an order, need help choosing a ribbon, or are interested in a bespoke commission. We aim to respond within 2 working days.
          </p>
        </div>

        {/* Two columns: form + info */}
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 60px 120px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }} className="contact-grid">

          {/* Form */}
          <form onSubmit={handleSubmit} aria-label="Contact us" aria-busy={status === 'sending'}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="contact-name" className="input-label">Your Name</label>
              <input id="contact-name" className="input" name="name" autoComplete="name" required value={form.name} onChange={handleChange} placeholder="Jane Smith" maxLength={100} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="contact-email" className="input-label">Email Address</label>
              <input id="contact-email" className="input" name="email" type="email" autoComplete="email" required value={form.email} onChange={handleChange} placeholder="jane@example.com" maxLength={254} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="contact-subject" className="input-label">Subject <span style={{ color: 'var(--warm)' }}>(optional)</span></label>
              <input id="contact-subject" className="input" name="subject" value={form.subject} onChange={handleChange} placeholder="Order enquiry, bespoke order…" maxLength={200} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label htmlFor="contact-message" className="input-label">Message</label>
              <textarea id="contact-message" className="input" name="message" required value={form.message} onChange={handleChange}
                placeholder="Tell us how we can help…" maxLength={5000}
                style={{ minHeight: 140, resize: 'vertical' }} />
            </div>

            {/* 蜜罐：移出屏幕、不可聚焦，读屏软件也跳过；自动填表的脚本会把它填上 */}
            <input
              name="website" value={form.website} onChange={handleChange}
              tabIndex={-1} autoComplete="off" aria-hidden="true"
              style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
            />

            <button type="submit" disabled={status === 'sending' || status === 'sent'} style={{
              width: '100%', height: 50,
              background: status === 'sent' ? 'var(--gold)' : 'var(--ink)',
              color: '#fff', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: status === 'sending' ? 'wait' : 'pointer',
              transition: 'background .28s',
            }}>
              {status === 'sending' ? 'Sending…' : status === 'sent' ? '✓  Message Sent' : 'Send Message'}
            </button>
            {status === 'error' && (
              <p role="alert" style={{ fontSize: 11, color: '#991B1B', marginTop: 12, lineHeight: 1.8 }}>
                {errorMsg || 'Sorry, your message could not be sent. Please try again.'}
              </p>
            )}
            {status === 'sent' && (
              <p role="status" style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 12, lineHeight: 1.8 }}>
                We&apos;ve received your message and sent a confirmation to your email. If you don&apos;t see it, feel free to reach us directly at <a href="mailto:song@onesilkribbon.com" style={{ color: 'var(--gold)' }}>song@onesilkribbon.com</a>.
              </p>
            )}
          </form>

          {/* Info panel */}
          <div style={{ paddingTop: 4 }}>
            {[
              { label: 'Email', value: 'song@onesilkribbon.com', href: 'mailto:song@onesilkribbon.com' },
              { label: 'Response Time', value: 'Within 2 working days' },
              { label: 'Order Enquiries', value: 'Please have your order number ready' },
              { label: 'Bespoke & Wholesale', value: 'We welcome custom and trade enquiries' },
            ].map(({ label, value, href }) => (
              <div key={label} style={{ padding: '18px 0', borderBottom: '1px solid var(--sand)' }}>
                <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 6 }}>{label}</p>
                {href
                  ? <a href={href} style={{ fontSize: 15, color: 'var(--gold)', textDecoration: 'none' }}>{value}</a>
                  : <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>{value}</p>
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .contact-grid > * { min-width: 0; overflow-wrap: anywhere; }
        @media(max-width: 768px) {
          .contact-hero { padding: 44px 20px 0 !important; }
          .contact-hero h1 { font-size: 36px !important; }
          .contact-hero > p:last-child { margin-bottom: 32px !important; padding-bottom: 28px !important; }
          .contact-grid { grid-template-columns: 1fr !important; padding: 0 20px 64px !important; gap: 32px !important; }
        }
      ` }} />
    </>
  )
}
