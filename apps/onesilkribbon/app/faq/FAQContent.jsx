'use client'
import { useState } from 'react'
import { getFaqs } from './faq-data'

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--sand)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', textAlign: 'left', padding: '20px 0',
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 300, color: 'var(--ink)', lineHeight: 1.35 }}>{q}</span>
        <span style={{ fontSize: 20, color: 'var(--warm)', flexShrink: 0, transition: 'transform .25s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.1, color: 'var(--taupe)', paddingBottom: 20, maxWidth: 680 }}>{a}</p>
      )}
    </div>
  )
}

export default function FAQContent({ shippingRate = '3.95', freeThreshold = '45', freeEnabled = true }) {
  const faqs = getFaqs({ shippingRate, freeThreshold, freeEnabled })

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Help</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)' }}>
            Frequently Asked<br /><em>Questions</em>
          </h1>
        </div>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 60px 120px' }} className="faq-pad">
          {faqs.map(({ category, items }) => (
            <div key={category} style={{ marginBottom: 64 }}>
              <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--sand)' }}>{category}</p>
              {items.map(item => <FAQItem key={item.q} {...item} />)}
            </div>
          ))}

          <div style={{ marginTop: 32, padding: '36px 40px', background: 'var(--sand)', borderTop: '2px solid var(--warm)' }}>
            <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--taupe)', lineHeight: 2 }}>
              Still have a question? Email us at{' '}
              <a href="mailto:song@onesilkribbon.com" style={{ color: 'var(--gold)', textDecoration: 'none' }}>song@onesilkribbon.com</a>
              {' '}and we will get back to you within 2 working days.
            </p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media(max-width: 768px) {
          .faq-pad { padding: 48px 24px 80px !important; }
          h1 { font-size: 36px !important; }
        }
      ` }} />
    </>
  )
}
