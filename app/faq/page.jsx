'use client'
import { useState } from 'react'

export const metadata = undefined // can't export from client component — set in a separate layout if needed

const faqs = [
  {
    category: 'Orders & Delivery',
    items: [
      { q: 'How long will my order take to arrive?', a: 'UK standard delivery takes 3–5 working days. Express (1–2 days) is available at checkout. We dispatch within 2–3 working days of your order. International delivery takes 7–14 days depending on destination.' },
      { q: 'Do you offer free shipping?', a: 'Yes — UK standard shipping is free on all orders over £45. Below that, it is £3.50. Express shipping is £5.95.' },
      { q: 'Can I track my order?', a: 'Yes. Once your order is dispatched you will receive a confirmation email with tracking information where available. You can also check your order status at /track-order.' },
      { q: 'Do you ship internationally?', a: 'Yes, we ship to Europe (£8.95) and worldwide (£12.95). Please note that international orders may be subject to import duties and taxes, which are the responsibility of the recipient.' },
    ],
  },
  {
    category: 'Products',
    items: [
      { q: 'What is Grade 6A mulberry silk?', a: 'Grade 6A is the highest classification of mulberry silk, denoting the longest, most consistent filaments with minimal breakage. It produces a smoother, more lustrous fabric with a superior drape — the grade used in luxury fashion and heirloom textiles.' },
      { q: 'What does "hand-torn" mean?', a: 'Our hand-frayed ribbons are torn along the grain of the silk rather than cut. This creates a naturally irregular, feathery edge that no machine can replicate — a texture unique to each yard.' },
      { q: 'Will the colour look exactly as shown on screen?', a: 'We photograph our ribbons carefully, but screen colours vary. Because our ribbons are naturally dyed, there can also be subtle batch-to-batch variation — which we consider part of their character. If colour accuracy is critical (e.g. for a wedding), contact us and we can send a sample.' },
      { q: 'Do you sell ribbon by the metre?', a: 'Yes. Most ribbons are sold per metre. Some products are available in pre-cut lengths (1m, 3m, 5m, 10m). The unit is shown clearly on each product page.' },
    ],
  },
  {
    category: 'Returns & Care',
    items: [
      { q: 'What is your returns policy?', a: 'We accept returns within 14 days of receipt. Items must be unused and in their original condition. Bespoke or custom-cut orders are non-refundable unless faulty. See our Shipping & Returns page for full details.' },
      { q: 'How do I care for my silk ribbon?', a: 'Hand wash gently in cool water with a mild detergent. Lay flat to dry away from direct sunlight. Iron on a low silk setting with a pressing cloth. Store rolled or flat, away from moisture and heat. See our full Care Guide for more.' },
      { q: 'My ribbon arrived damaged — what do I do?', a: 'We are sorry to hear that. Please email hello@onesilkribbon.com within 7 days of receipt with your order number and a photo of the damage. We will arrange a replacement or full refund at no cost to you.' },
    ],
  },
  {
    category: 'Bespoke & Wholesale',
    items: [
      { q: 'Can I order a custom colour?', a: 'Yes. We welcome bespoke commissions for specific colourways, widths, and lengths. Minimum order is typically 10 metres per colourway. Visit our Bespoke page or email hello@onesilkribbon.com to start a conversation.' },
      { q: 'Do you offer trade or wholesale pricing?', a: 'Yes, we work with florists, stylists, boutiques, and brands. Email hello@onesilkribbon.com with details about your business and requirements and we will send you our wholesale information.' },
    ],
  },
]

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
        <p style={{ fontSize: 13, lineHeight: 2.1, color: 'var(--taupe)', paddingBottom: 20, maxWidth: 680 }}>{a}</p>
      )}
    </div>
  )
}

export default function FAQ() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Help</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)' }}>
            Frequently Asked<br /><em>Questions</em>
          </h1>
        </div>

        {/* FAQ sections */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 60px 120px' }} className="faq-pad">
          {faqs.map(({ category, items }) => (
            <div key={category} style={{ marginBottom: 64 }}>
              <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--sand)' }}>{category}</p>
              {items.map(item => <FAQItem key={item.q} {...item} />)}
            </div>
          ))}

          <div style={{ marginTop: 32, padding: '36px 40px', background: 'var(--sand)', borderTop: '2px solid var(--warm)' }}>
            <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 2 }}>
              Still have a question? Email us at{' '}
              <a href="mailto:hello@onesilkribbon.com" style={{ color: 'var(--gold)', textDecoration: 'none' }}>hello@onesilkribbon.com</a>
              {' '}and we will get back to you within 2 working days.
            </p>
          </div>
        </div>

      </div>

      <style>{`
        @media(max-width: 768px) {
          .faq-pad { padding: 48px 24px 80px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </>
  )
}
