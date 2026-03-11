'use client'
import { useState, useEffect } from 'react'
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

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFeatured() {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, slug, images, collection')
        .limit(4)

      if (prods) {
        const enriched = await Promise.all(prods.map(async (p) => {
          const { data: skus } = await supabase
            .from('product_skus')
            .select('price_gbp, colour_hex')
            .eq('product_id', p.id)
            .order('price_gbp', { ascending: true })
          
          return {
            ...p,
            price: skus?.[0]?.price_gbp || 0,
            swatches: skus?.slice(0, 5).map(s => s.colour_hex) || []
          }
        }))
        setFeaturedProducts(enriched)
      }
      setLoading(false)
    }
    loadFeatured()

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
      <FeaturedProducts products={featuredProducts} loading={loading} />
      <JournalSection />
      <NewsletterSection />

      <style>{`
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.9s ease, transform 0.9s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .col-card:hover .col-img-inner { transform: scale(1.05); }
        .prod-card:hover .prod-img-inner { transform: scale(1.04); }
        .prod-card:hover .quick-add { transform: translateY(0) !important; }
        .palette-swatch:hover { flex: 2.5 !important; }
        .palette-swatch:hover .swatch-name { opacity: 1 !important; }
      `}</style>
    </>
  )
}

/* ═══════════════════════════════════
   HERO — 移动端改为单栏垂直布局
   ═══════════════════════════════════ */
function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-text">
        <svg className="hero-svg" viewBox="0 0 400 200" fill="none">
          <path d="M 0 100 Q 50 20 100 100 Q 150 180 200 100 Q 250 20 300 100 Q 350 180 400 100" stroke="#9A8878" strokeWidth="1.5" fill="none"/>
        </svg>
        <p className="eyebrow" style={{ marginBottom: 24 }}>100% Pure Mulberry Silk · Handcrafted</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,86px)', fontWeight: 300, lineHeight: 1.05, color: 'var(--ink)', marginBottom: 32 }}>
          Woven from  
<em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>nature's</em>  
finest thread
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--taupe)', maxWidth: 340, marginBottom: 52 }}>
          Each ribbon carries the quiet beauty of silk in its most natural form — hand-treated, botanically inspired, made to last.
        </p>
        <Link href="/collections"><button className="btn-text"><span className="line" />Explore Collections</button></Link>
      </div>
      <div className="hero-image">
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1C1714,#3D3530,#6B5A4E,#9A8878,#C4A882,#E8DDD0)', animation: 'heroZoom 12s ease-out forwards' }} />
      </div>
      <style>{`
        .hero-section {
          height: 100vh;
          min-height: 600px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
        }
        .hero-text {
          background: var(--sand);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 80px 100px 80px;
          position: relative;
          overflow: hidden;
        }
        .hero-svg {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          opacity: 0.12; width: 600px;
          animation: float 8s ease-in-out infinite;
        }
        .hero-image {
          background: #2A2420;
          position: relative;
          overflow: hidden;
        }

        /* ── 移动端 ── */
        @media (max-width: 768px) {
          .hero-section {
            grid-template-columns: 1fr;
            grid-template-rows: 45vh 1fr;
            height: auto;
            min-height: 100vh;
            min-height: 100dvh;
          }
          .hero-image {
            order: -1; /* 图片在上方 */
          }
          .hero-text {
            padding: 40px 24px 60px;
            justify-content: flex-start;
          }
          .hero-svg { width: 300px; }
        }
        @media (max-width: 480px) {
          .hero-section {
            grid-template-rows: 35vh 1fr;
          }
        }
        @keyframes float { 0%,100%{transform:translate(-50%,-50%) rotate(0deg)} 50%{transform:translate(-50%,-48%) rotate(-1deg)} }
        @keyframes heroZoom { from{transform:scale(1.06)} to{transform:scale(1)} }
      `}</style>
    </section>
  )
}

function Marquee() {
  const items = ['Fine Silk Ribbons','Hand-Frayed Collection','Handcrafted Adornments','Patterned Ribbons','Studio Tools','Vintage-Inspired','200+ Colourways','Free UK Shipping over £45']
  return (
    <div style={{ background: 'var(--deep)', padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'inline-flex', animation: 'marquee 24s linear infinite' }}>
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--warm)', padding: '0 40px' }}>{item} ·</span>
        ))}
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  )
}

/* ═══════════════════════════════════
   COLLECTIONS — 移动端改为滚动卡片
   ═══════════════════════════════════ */
function Collections() {
  return (
    <section className="collections-section">
      <div style={{ textAlign: 'center', marginBottom: 80 }} className="reveal collections-header">
        <span className="eyebrow">Our Collections</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 300, marginTop: 20 }}>Six expressions of <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>pure silk</em></h2>
      </div>
      <div className="collections-grid">
        {COLLECTIONS.map(c => (
          <Link key={c.slug} href={`/collections/${c.slug}`} className="col-card" style={{ textDecoration: 'none' }}>
            <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <span style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 2vw, 24px)', zIndex: 1, textAlign: 'center', padding: '0 12px' }}>{c.name}</span>
              <div className="col-img-inner" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', transition: 'transform 0.8s ease' }} />
            </div>
          </Link>
        ))}
      </div>
      <style>{`
        .collections-section { padding: var(--section-padding-y) 0; }
        .collections-header { padding: 0 var(--page-padding); margin-bottom: 60px; }
        .collections-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          padding: 0 var(--page-padding);
        }
        .col-card { height: 400px; }
        @media (max-width: 768px) {
          .collections-header { margin-bottom: 32px !important; }
          .collections-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 2px;
            padding: 0;
          }
          .col-card { height: 220px; }
        }
        @media (max-width: 480px) {
          .col-card { height: 180px; }
        }
      `}</style>
    </section>
  )
}

function PaletteBand() {
  return (
    <Link href="/palette" style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
      <section className="reveal palette-band" style={{ display: 'flex', background: 'var(--deep)', overflow: 'hidden', cursor: 'pointer' }}>
        {PALETTE.map(p => (
          <div key={p.name} className="palette-swatch" style={{ flex: 1, background: p.hex, transition: 'flex 0.6s cubic-bezier(0.25,0.46,0.45,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span className="swatch-name" style={{ opacity: 0, color: p.dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', transform: 'rotate(-90deg)', whiteSpace: 'nowrap', transition: 'opacity 0.4s' }}>{p.name}</span>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} className="palette-cta">
          <span style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.3)', padding: '8px 20px', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}>
            Explore The Palette →
          </span>
        </div>
      </section>
      <style>{`
        .palette-band { height: 400px; }
        .palette-band:hover .palette-cta span { color: #fff !important; background: rgba(0,0,0,0.5) !important; }
        @media (max-width: 768px) {
          .palette-band { height: 200px; }
          .swatch-name { display: none !important; }
          .palette-cta { bottom: 16px !important; }
          .palette-cta span { font-size: 8px !important; padding: 6px 14px !important; }
        }
      `}</style>
    </Link>
  )
}

function StorySection() {
  return (
    <section className="story-section reveal">
      <div className="story-inner">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300, marginBottom: 40, lineHeight: 1.3 }}>
          "Silk is the <em style={{ fontStyle: 'italic' }}>poetry</em> of the loom, a thread that connects the earth to the artisan's hand."
        </h2>
        <p style={{ fontSize: 15, color: 'var(--taupe)', lineHeight: 2, marginBottom: 60 }}>
          In our studio, we treat every spool as a micro-masterpiece. From botanical dyeing to hand-fraying, our process is slow, intentional, and deeply rooted in the heritage of fine craft.
        </p>
        <Link href="/about" className="btn-text"><span className="line" />Our Story</Link>
      </div>
      <style>{`
        .story-section { padding: var(--section-padding-y) 0; background: var(--cream); text-align: center; }
        .story-inner { max-width: 800px; margin: 0 auto; padding: 0 var(--page-padding); }
      `}</style>
    </section>
  )
}

/* ═══════════════════════════════════
   FEATURED PRODUCTS — 移动端两栏
   ═══════════════════════════════════ */
function FeaturedProducts({ products, loading }) {
  return (
    <section className="featured-section">
      <div className="featured-header">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300 }}>Artisan <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>Favourites</em></h2>
        <Link href="/collections" className="btn-text featured-viewall"><span className="line" />View All</Link>
      </div>
      <div className="featured-grid">
        {products.map(p => (
          <Link key={p.id} href={`/products/${p.slug}`} style={{ textDecoration: 'none' }} className="prod-card">
            <div style={{ aspectRatio: '3/4', background: 'var(--sand)', marginBottom: 16, overflow: 'hidden', position: 'relative' }}>
              {p.images?.[0] && <img src={p.images[0]} className="prod-img-inner" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s ease' }} />}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 1.5vw, 18px)', color: 'var(--ink)' }}>{p.name}</h3>
            <p style={{ fontSize: 14, color: 'var(--taupe)', marginTop: 8 }}>From {formatGBP(p.price)}</p>
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {p.swatches.map((hex, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: hex, border: '1px solid rgba(0,0,0,0.05)' }} />
              ))}
            </div>
          </Link>
        ))}
      </div>
      <style>{`
        .featured-section { padding: var(--section-padding-y) var(--page-padding); background: var(--mist); }
        .featured-header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 48px; flex-wrap: wrap; gap: 16px;
        }
        .featured-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }
        @media (max-width: 1024px) { .featured-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) {
          .featured-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .featured-header { margin-bottom: 32px; }
        }
      `}</style>
    </section>
  )
}

function JournalSection() {
  return (
    <section className="journal-section reveal">
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <span className="eyebrow">The Journal</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300, marginTop: 20 }}>Notes from the <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>Atelier</em></h2>
      </div>
      <div className="journal-grid">
        <div style={{ background: 'var(--sand)', height: 'clamp(280px, 40vw, 500px)' }}></div>
        <div style={{ background: 'var(--sand)', height: 'clamp(280px, 40vw, 500px)' }}></div>
      </div>
      <style>{`
        .journal-section { padding: var(--section-padding-y) var(--page-padding); }
        .journal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) {
          .journal-grid { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>
    </section>
  )
}

function NewsletterSection() {
  return (
    <section className="newsletter-section">
      <div className="newsletter-inner">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 300, marginBottom: 20 }}>Join the Atelier</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 40, letterSpacing: '0.05em' }}>Receive seasonal palette updates and artisan stories.</p>
        <div className="newsletter-form">
          <input type="email" placeholder="Email Address" style={{ background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none', fontSize: 16, minWidth: 0 }} />
          <button style={{ background: 'none', border: 'none', color: 'var(--gold)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.2em', whiteSpace: 'nowrap', padding: '8px 0' }}>Subscribe</button>
        </div>
      </div>
      <style>{`
        .newsletter-section {
          padding: var(--section-padding-y) var(--page-padding);
          background: var(--deep); color: #fff; text-align: center;
        }
        .newsletter-inner { max-width: 500px; margin: 0 auto; }
        .newsletter-form {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          padding-bottom: 12px;
          gap: 12px;
        }
        @media (max-width: 480px) {
          .newsletter-form {
            flex-direction: column;
            border-bottom: none;
            gap: 16px;
          }
          .newsletter-form input {
            border-bottom: 1px solid rgba(255,255,255,0.2);
            padding-bottom: 12px;
          }
          .newsletter-form button {
            border: 1px solid rgba(255,255,255,0.2);
            padding: 14px !important;
          }
        }
      `}</style>
    </section>
  )
}
