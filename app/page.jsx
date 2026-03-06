'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatGBP } from '@/lib/pricing'
import { useCart } from '@/lib/cart'

// ── Collection data ──────────────────────
const COLLECTIONS = [
  { name: 'Fine Silk Ribbons',       slug: 'fine-silk-ribbons',       count: '30 colourways', bg: 'linear-gradient(160deg,#D4C5B0,#9A8878,#C4A882)', featured: true },
  { name: 'Hand-Frayed',             slug: 'hand-frayed-silk-ribbons', count: '18 styles',     bg: 'linear-gradient(160deg,#E8C9B8,#C9A48A,#9A7A66)' },
  { name: 'Adornments',              slug: 'handcrafted-adornments',   count: '12 designs',    bg: 'linear-gradient(160deg,#B8A898,#7A6A5A,#4A3A30)' },
  { name: 'Patterned',               slug: 'patterned-ribbons',        count: '14 patterns',   bg: 'linear-gradient(160deg,#C8D4C0,#8A9A80,#5A7050)' },
  { name: 'Studio Tools',            slug: 'studio-tools',             count: '8 essentials',  bg: 'linear-gradient(160deg,#D0D0C8,#9A9A90,#5A5A54)' },
  { name: 'Vintage-Inspired',        slug: 'vintage-inspired-ribbons', count: '16 styles',     bg: 'linear-gradient(160deg,#D4B8C0,#9A7A84,#5A3A44)' },
]

const PALETTE = [
  { hex: '#F0EAE0', name: 'Antique Lace',  dark: false },
  { hex: '#E8C9B8', name: 'Blush Petal',   dark: false },
  { hex: '#D4A882', name: 'Warm Sand',      dark: false },
  { hex: '#B89B6A', name: 'Gold Dust',      dark: false },
  { hex: '#9A8878', name: 'Driftwood',      dark: true  },
  { hex: '#7A6A5A', name: 'Deep Taupe',     dark: true  },
  { hex: '#C8D4C0', name: 'Sage Mist',      dark: false },
  { hex: '#8A9A80', name: 'Fern',           dark: true  },
  { hex: '#5A7050', name: 'Forest',         dark: true  },
  { hex: '#D4B8C0', name: 'Rose Ash',       dark: false },
  { hex: '#9A7A84', name: 'Mauve',          dark: true  },
  { hex: '#5A3A44', name: 'Bordeaux',       dark: true  },
  { hex: '#2A2420', name: 'Midnight',       dark: true  },
]

// Sample featured products (replaced by DB data in production)
const FEATURED = [
  { id: '1', name: 'Ultra-Fine Silk Ribbon', collection: 'Fine Silk Ribbons', details: '7mm · 10m Spool · 30 Colourways', price: 9.90, badge: 'Bestseller', bg: 'linear-gradient(170deg,#E8DDD0,#C4A882,#9A8878)', swatches: ['#F0EAE0','#E8C9B8','#B89B6A','#9A8878','#2A2420'], slug: '7mm-mulberry-silk-ribbon' },
  { id: '2', name: 'Frayed Edge Silk Ribbon', collection: 'Hand-Frayed', details: '25mm · 5m Spool · 18 Colourways', price: 14.90, badge: 'New', bg: 'linear-gradient(170deg,#E8C9B8,#C9A48A,#A0806A)', swatches: ['#E8C9B8','#D4A882','#9A7A66','#5A3A44'], slug: 'hand-frayed-25mm' },
  { id: '3', name: 'Heritage Woven Ribbon', collection: 'Vintage-Inspired', details: '38mm · 3m Length · 16 Tones', price: 18.50, badge: null, bg: 'linear-gradient(170deg,#C8D4C0,#8A9A80,#5A7050)', swatches: ['#C8D4C0','#8A9A80','#D4B8C0','#7A6A5A'], slug: 'heritage-woven-38mm' },
  { id: '4', name: 'Botanical Print Silk', collection: 'Patterned Ribbons', details: '50mm · 2m Length · 14 Patterns', price: 22.00, badge: 'Popular', bg: 'linear-gradient(170deg,#D4B8C0,#9A7A84,#786070)', swatches: ['#D4B8C0','#9A7A84','#C8D4C0','#2A2420'], slug: 'botanical-print-50mm' },
]

export default function HomePage() {
  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
    }, { threshold: 0.08 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <Hero />
      <Marquee />
      <Collections />
      <PaletteBand />
      <StorySection />
      <FeaturedProducts />
      <JournalSection />
      <NewsletterSection />

      <style>{`
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.9s ease, transform 0.9s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .col-card { cursor: pointer; }
        .col-card:hover .col-img-inner { transform: scale(1.05); }
        .col-card:hover .col-arrow { opacity: 1 !important; transform: scale(1) !important; }
        .col-card:hover .col-name { transform: translateY(0) !important; }
        .col-card:hover .col-count { color: var(--gold) !important; }
        .prod-card:hover .prod-img-inner { transform: scale(1.04); }
        .prod-card:hover .quick-add { transform: translateY(0) !important; }
        .journal-card:hover .journal-img-inner { transform: scale(1.04); }
        .palette-swatch:hover { flex: 2.5 !important; }
        .palette-swatch:hover .swatch-name { opacity: 1 !important; }
      `}</style>
    </>
  )
}

// ── HERO ─────────────────────────────────
function Hero() {
  return (
    <section style={{
      height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
      overflow: 'hidden',
    }} className="hero-section">
      {/* Left */}
      <div style={{
        background: 'var(--sand)', display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '0 80px 100px 80px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative ribbon SVG */}
        <svg style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.12, width: 600, animation: 'float 8s ease-in-out infinite' }}
          viewBox="0 0 400 200" fill="none">
          <path d="M 0 100 Q 50 20 100 100 Q 150 180 200 100 Q 250 20 300 100 Q 350 180 400 100"
            stroke="#9A8878" strokeWidth="1.5" fill="none"/>
          <path d="M 0 120 Q 50 40 100 120 Q 150 200 200 120 Q 250 40 300 120 Q 350 200 400 120"
            stroke="#C4A882" strokeWidth="0.8" fill="none" opacity="0.5"/>
        </svg>

        <p className="eyebrow" style={{ marginBottom: 24, animation: 'fadeUp 1s 0.3s both' }}>
          100% Pure Mulberry Silk · Handcrafted
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(52px,6vw,86px)',
          fontWeight: 300, lineHeight: 1.05, color: 'var(--ink)', marginBottom: 32,
          animation: 'fadeUp 1.1s 0.5s both',
        }}>
          Woven from<br/>
          <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>nature's</em><br/>
          finest thread
        </h1>
        <p style={{
          fontSize: 13, lineHeight: 1.9, color: 'var(--taupe)',
          maxWidth: 340, marginBottom: 52,
          animation: 'fadeUp 1.1s 0.7s both',
        }}>
          Each ribbon carries the quiet beauty of silk in its most natural form — hand-treated, botanically inspired, made to last.
        </p>
        <Link href="/collections" style={{ animation: 'fadeUp 1.1s 0.9s both', display: 'inline-block' }}>
          <button className="btn-text">
            <span className="line" />
            Explore Collections
          </button>
        </Link>
      </div>

      {/* Right — visual */}
      <div style={{ background: '#2A2420', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg,#1C1714,#3D3530,#6B5A4E,#9A8878,#C4A882,#E8DDD0)',
          animation: 'heroZoom 12s ease-out forwards',
        }} />
        {/* Ribbon overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <svg style={{ width: '75%', opacity: 0.25 }} viewBox="0 0 600 300" fill="none">
            <path d="M 0 150 Q 75 50 150 150 Q 225 250 300 150 Q 375 50 450 150 Q 525 250 600 150"
              stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" fill="none"/>
            <path d="M 0 170 Q 75 70 150 170 Q 225 270 300 170 Q 375 70 450 170 Q 525 270 600 170"
              stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>
        <div style={{
          position: 'absolute', bottom: 40, right: 40,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          animation: 'fadeIn 1s 1.5s both',
        }}>
          <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,0.3)', animation: 'scrollPulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', writingMode: 'vertical-rl' }}>Scroll</span>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%,100%{transform:translate(-50%,-50%) rotate(0deg)} 33%{transform:translate(-50%,-52%) rotate(1.5deg)} 66%{transform:translate(-50%,-48%) rotate(-1deg)} }
        @keyframes heroZoom { from{transform:scale(1.06)} to{transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scrollPulse { 0%,100%{transform:scaleY(1);opacity:.4} 50%{transform:scaleY(.5);opacity:1} }
        @media(max-width:900px) {
          .hero-section { grid-template-columns:1fr !important; }
          .hero-section > div:last-child { display:none; }
          .hero-section > div:first-child { min-height:100vh; padding:120px 32px 80px !important; justify-content:center !important; }
        }
      `}</style>
    </section>
  )
}

// ── MARQUEE ──────────────────────────────
function Marquee() {
  const items = ['Fine Silk Ribbons','Hand-Frayed Collection','Handcrafted Adornments','Patterned Ribbons','Studio Tools','Vintage-Inspired','200+ Colourways','Free UK Shipping over £45']
  const doubled = [...items, ...items]
  return (
    <div style={{ background: 'var(--deep)', padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'inline-flex', animation: 'marquee 24s linear infinite' }}>
        {doubled.map((item, i) => (
          <span key={i}>
            <span style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--warm)', padding: '0 40px' }}>{item}</span>
            <span style={{ color: 'var(--gold)', fontSize: 14, verticalAlign: 'middle' }}>·</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  )
}

// ── COLLECTIONS ──────────────────────────
function Collections() {
  return (
    <section id="collections">
      <div className="section-header reveal">
        <span className="eyebrow" style={{ marginBottom: 20 }}>Our Collections</span>
        <h2 className="display-title">Six expressions of <em>pure silk</em></h2>
        <div className="rule" />
      </div>

      <div style={{ padding: '0 60px 120px' }} className="reveal collections-pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }} className="coll-grid">
          {COLLECTIONS.map((c, i) => (
            <Link key={c.slug} href={`/collections/${c.slug}`}
              style={{ gridColumn: c.featured ? 'span 2' : undefined, gridRow: c.featured ? 'span 2' : undefined }}>
              <div className="col-card" style={{ position: 'relative', overflow: 'hidden', aspectRatio: c.featured ? 'auto' : '1' }}>
                <div className="col-img-inner" style={{
                  width: '100%', minHeight: c.featured ? 580 : 280,
                  background: c.bg,
                  transition: 'transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94)',
                }} />
                {/* Overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top,rgba(28,23,20,0.75) 0%,transparent 55%)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 36,
                }}>
                  <p className="col-name" style={{
                    fontFamily: 'var(--font-display)', fontSize: c.featured ? 32 : 22,
                    fontWeight: 400, color: '#fff', letterSpacing: '0.04em', marginBottom: 8,
                    transform: 'translateY(4px)', transition: 'transform 0.4s',
                  }}>{c.name}</p>
                  <p className="col-count" style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', transition: 'color 0.4s' }}>
                    {c.count}
                  </p>
                </div>
                {/* Arrow */}
                <div className="col-arrow" style={{
                  position: 'absolute', top: 28, right: 28, width: 36, height: 36,
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transform: 'scale(0.8)', transition: 'opacity 0.4s, transform 0.4s',
                }}>
                  <svg width="14" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="1.5">
                    <path d="M2 7h10M7 2l5 5-5 5"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <style>{`
        @media(max-width:900px) { .coll-grid{grid-template-columns:1fr 1fr !important} }
        @media(max-width:600px) { .coll-grid{grid-template-columns:1fr !important} .collections-pad{padding:0 24px 80px !important} }
      `}</style>
    </section>
  )
}

// ── PALETTE BAND ─────────────────────────
function PaletteBand() {
  return (
    <div style={{ height: 80, display: 'flex', overflow: 'hidden' }}>
      {PALETTE.map((p) => (
        <div key={p.hex} className="palette-swatch"
          style={{ flex: 1, background: p.hex, position: 'relative', transition: 'flex 0.5s ease' }}>
          <span className="swatch-name" style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: p.dark ? 'rgba(255,255,255,0.7)' : 'rgba(28,23,20,0.6)',
            opacity: 0, whiteSpace: 'nowrap', transition: 'opacity 0.3s',
          }}>
            {p.name}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── STORY ────────────────────────────────
function StorySection() {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '80vh' }} className="story-grid">
      {/* Visual */}
      <div style={{ background: 'var(--deep)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 600 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1C1714,#3D3530,#6B5A4E)' }} />
        <svg style={{ width: '65%', opacity: 0.4, position: 'relative', zIndex: 1 }} viewBox="0 0 400 300" fill="none">
          <path d="M 20 150 Q 70 50 120 150 Q 170 250 220 150 Q 270 50 320 150 Q 370 250 380 200"
            stroke="#C4A882" strokeWidth="2.5" fill="none"/>
          <path d="M 20 170 Q 70 70 120 170 Q 170 270 220 170 Q 270 70 320 170 Q 370 270 380 220"
            stroke="#9A8878" strokeWidth="1.5" fill="none" opacity="0.6"/>
          <circle cx="200" cy="150" r="70" stroke="#B89B6A" strokeWidth="0.5" fill="none" opacity="0.25"/>
          <circle cx="200" cy="150" r="100" stroke="#B89B6A" strokeWidth="0.3" fill="none" opacity="0.15"/>
        </svg>
      </div>

      {/* Content */}
      <div style={{ background: 'var(--sand)', padding: '100px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        className="story-content reveal">
        <span className="eyebrow" style={{ marginBottom: 20 }}>Our Philosophy</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,3.5vw,54px)', fontWeight: 300, lineHeight: 1.2, color: 'var(--ink)', marginBottom: 32 }}>
          Silk in its<br/><em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>most natural</em><br/>form
        </h2>
        <p style={{ fontSize: 14, lineHeight: 2, color: 'var(--taupe)', maxWidth: 420, marginBottom: 48 }}>
          We begin with 100% pure mulberry silk, chosen for its incomparable softness and natural drape. Each ribbon is hand-treated to honour texture, subtle colour, and the quiet beauty found only in things made slowly, by hand.
        </p>
        <Link href="/about">
          <button className="btn-text">
            <span className="line" />Read Our Story
          </button>
        </Link>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 48, paddingTop: 40, borderTop: '1px solid var(--warm)', marginTop: 48 }}>
          {[['200+','Colourways'],['6','Collections'],['100%','Mulberry Silk']].map(([n,l]) => (
            <div key={l}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 300, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>{n}</span>
              <span style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginTop: 8, display: 'block' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media(max-width:900px) { .story-grid{grid-template-columns:1fr !important} .story-content{padding:60px 32px !important} }
      `}</style>
    </section>
  )
}

// ── FEATURED PRODUCTS ────────────────────
function FeaturedProducts() {
  const { addItem } = useCart()

  const handleAdd = (product) => {
    addItem({
      skuId: product.id,
      productId: product.id,
      name: product.name,
      skuDesc: product.details,
      colour: 'Natural',
      colourHex: '#D4C5B0',
      price: product.price,
      qty: 1,
      image: null,
    })
  }

  return (
    <section style={{ padding: '0 60px 120px', background: 'var(--cream)' }} className="products-pad">
      <div className="section-header reveal" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <span className="eyebrow" style={{ marginBottom: 20 }}>Featured Pieces</span>
        <h2 className="display-title">Made to be <em>touched</em></h2>
        <div className="rule" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 28 }}
        className="reveal products-grid">
        {FEATURED.map(p => (
          <div key={p.id} className="prod-card" style={{ cursor: 'pointer' }}>
            <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: 'var(--sand)', marginBottom: 20, position: 'relative' }}>
              <div className="prod-img-inner" style={{ width: '100%', height: '100%', background: p.bg, transition: 'transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
              {p.badge && (
                <div style={{ position: 'absolute', top: 16, left: 16, background: 'var(--deep)', color: '#fff', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '5px 10px' }}>
                  {p.badge}
                </div>
              )}
              <div className="quick-add" onClick={() => handleAdd(p)} style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(28,23,20,0.9)', color: '#fff', textAlign: 'center',
                padding: 14, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
                transform: 'translateY(100%)', transition: 'transform 0.4s',
              }}>
                Add to Basket
              </div>
            </div>
            <Link href={`/products/${p.slug}`}>
              <span className="eyebrow" style={{ marginBottom: 8 }}>{p.collection}</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.3 }}>{p.name}</h3>
              <p style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--taupe)', marginBottom: 12 }}>{p.details}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--deep)' }}>{formatGBP(p.price)}</p>
            </Link>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {p.swatches.map(hex => (
                <div key={hex} style={{ width: 14, height: 14, borderRadius: '50%', background: hex, border: '1px solid var(--warm)' }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 60 }}>
        <Link href="/collections">
          <button className="btn-text" style={{ margin: '0 auto' }}>
            <span className="line" />View All Products
          </button>
        </Link>
      </div>

      <style>{`
        @media(max-width:900px){.products-grid{grid-template-columns:1fr 1fr !important}}
        @media(max-width:600px){.products-grid{grid-template-columns:1fr !important}.products-pad{padding:0 24px 80px !important}}
      `}</style>
    </section>
  )
}

// ── JOURNAL ──────────────────────────────
function JournalSection() {
  const posts = [
    { cat: 'Craft & Technique', title: 'The Art of Hand-Fraying: Why Imperfection is Everything', date: 'February 2026', bg: 'linear-gradient(160deg,#3D3530,#6B5A4E,#9A8878)' },
    { cat: 'Colour Stories', title: 'Botanical Dyeing and the Colours of the Earth', date: 'January 2026', bg: 'linear-gradient(160deg,#2A2A24,#4A4A3A,#7A7A60)' },
    { cat: 'Styling', title: 'Six Ways to Style Silk Ribbons for Spring Weddings', date: 'December 2025', bg: 'linear-gradient(160deg,#3A2A2A,#5A3A3A,#8A5A5A)' },
  ]

  return (
    <section style={{ padding: '120px 60px', background: 'var(--ink)' }} className="journal-pad">
      <div className="section-header reveal" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <span className="eyebrow" style={{ marginBottom: 20 }}>Journal & Stories</span>
        <h2 className="display-title" style={{ color: 'var(--cream)' }}>The world of <em style={{ color: 'var(--warm)' }}>silk craft</em></h2>
        <div className="rule" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 2, marginTop: 60 }}
        className="reveal journal-grid">
        {posts.map((p, i) => (
          <div key={i} className="journal-card" style={{ overflow: 'hidden' }}>
            <div className="journal-img-inner" style={{ aspectRatio: '4/5', background: p.bg, transition: 'transform 0.7s ease' }} />
            <div style={{ paddingTop: 28 }}>
              <span className="eyebrow" style={{ marginBottom: 12 }}>{p.cat}</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--cream)', lineHeight: 1.3, marginBottom: 12 }}>{p.title}</h3>
              <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '0.1em' }}>{p.date}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media(max-width:900px){.journal-grid{grid-template-columns:1fr 1fr !important}}
        @media(max-width:600px){.journal-grid{grid-template-columns:1fr !important}.journal-pad{padding:80px 24px !important}}
      `}</style>
    </section>
  )
}

// ── NEWSLETTER ───────────────────────────
function NewsletterSection() {
  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = e.target.email.value
    if (!email) return
    try {
      await supabase.from('newsletter_subscribers').insert({ email })
      e.target.reset()
      alert('Thank you for subscribing!')
    } catch { /* already subscribed */ }
  }

  return (
    <section style={{ background: 'var(--sand)', padding: '120px 60px', textAlign: 'center' }}
      className="reveal newsletter-pad">
      <span className="eyebrow" style={{ marginBottom: 20 }}>Stay Close</span>
      <h2 className="display-title" style={{ marginBottom: 20 }}>Letters from<br/>the <em>studio</em></h2>
      <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 1.9, maxWidth: 420, margin: '0 auto 52px' }}>
        New colourways, restocks, and quiet stories from our atelier — delivered gently to your inbox.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', justifyContent: 'center', maxWidth: 480, margin: '0 auto' }}>
        <input name="email" type="email" className="input" placeholder="Your email address"
          style={{ borderRight: 'none', flex: 1 }} required />
        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '16px 32px', whiteSpace: 'nowrap' }}>
          Subscribe
        </button>
      </form>
      <style>{`@media(max-width:600px){.newsletter-pad{padding:80px 24px !important}}`}</style>
    </section>
  )
}
