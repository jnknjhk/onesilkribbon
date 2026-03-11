'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatGBP } from '@/lib/pricing'
import { useCart } from '@/lib/cart'

// ── Collection data ──────────────────────
const COLLECTIONS = [
  { name: 'Fine Silk Ribbons',       slug: 'fine-silk-ribbons',        count: '30 colourways' },
  { name: 'Hand-Frayed',             slug: 'hand-frayed-silk-ribbons', count: '18 styles' },
  { name: 'Adornments',              slug: 'handcrafted-adornments',   count: '12 designs' },
  { name: 'Patterned',               slug: 'patterned-ribbons',        count: '14 patterns' },
  { name: 'Studio Tools',            slug: 'studio-tools',             count: '8 essentials' },
  { name: 'Vintage-Inspired',        slug: 'vintage-inspired-ribbons', count: '16 styles' },
]

const COLLECTION_FALLBACK_BG = {
  'fine-silk-ribbons':        'linear-gradient(160deg,#D4C5B0,#9A8878,#C4A882)',
  'hand-frayed-silk-ribbons': 'linear-gradient(160deg,#E8C9B8,#C9A48A,#9A7A66)',
  'handcrafted-adornments':   'linear-gradient(160deg,#B8A898,#7A6A5A,#4A3A30)',
  'patterned-ribbons':        'linear-gradient(160deg,#C8D4C0,#8A9A80,#5A7050)',
  'studio-tools':             'linear-gradient(160deg,#D0D0C8,#9A9A90,#5A5A54)',
  'vintage-inspired-ribbons': 'linear-gradient(160deg,#D4B8C0,#9A7A84,#5A3A44)',
}

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
  const [collectionImages, setCollectionImages] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      // 1. 每个 collection 的封面图
      const imgMap = {}
      for (const col of COLLECTIONS) {
        const { data: colProds } = await supabase
          .from('products')
          .select('images')
          .eq('collection', col.slug)
          .eq('is_active', true)
          .limit(3)
        if (colProds) {
          for (const p of colProds) {
            const imgs = Array.isArray(p.images) ? p.images : []
            if (imgs.length > 0) { imgMap[col.slug] = imgs[0]; break }
          }
        }
      }
      setCollectionImages(imgMap)

      // 3. 精选产品
      const { data: prods } = await supabase
        .from('products').select('id, name, slug, images, collection').limit(4)
      if (prods) {
        const enriched = await Promise.all(prods.map(async (p) => {
          const { data: skus } = await supabase
            .from('product_skus').select('price_gbp, colour_hex')
            .eq('product_id', p.id).order('price_gbp', { ascending: true })
          return { ...p, price: skus?.[0]?.price_gbp || 0, swatches: skus?.slice(0, 5).map(s => s.colour_hex) || [] }
        }))
        setFeaturedProducts(enriched)
      }
      setLoading(false)
    }
    loadData()

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
      <Collections collectionImages={collectionImages} />
      <PaletteBand />
      <StorySection />
      <FeaturedProducts products={featuredProducts} loading={loading} />
      <NewsletterSection />

      <style>{`
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.9s ease, transform 0.9s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .col-card:hover .col-img-inner { transform: scale(1.06); }
        .col-card:hover .col-overlay { opacity: 0.25 !important; }
        .col-card:hover .col-cta-line { width: 40px !important; }
        .prod-card:hover .prod-img-inner { transform: scale(1.04); }
        .prod-card:hover .quick-add { transform: translateY(0) !important; }
        .palette-swatch:hover { flex: 2.5 !important; }
        .palette-swatch:hover .swatch-name { opacity: 1 !important; }
      `}</style>
    </>
  )
}


/* ═══════════════════════════════════════════════════════
   HERO — 多图交叉淡入淡出 + Ken Burns + 文字淡入动画
   ═══════════════════════════════════════════════════════
   换图方法：替换 public/images/ 下的 hero-1.jpg ~ hero-4.jpg
   增减图片：修改下面 HERO_IMAGES 数组即可
*/
const HERO_IMAGES = [
  '/images/hero-1.jpg',
  '/images/hero-2.jpg',
  '/images/hero-3.jpg',
  '/images/hero-4.jpg',
]

function Hero() {
  const [loaded, setLoaded] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // 触发文字淡入
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200)
    return () => clearTimeout(timer)
  }, [])

  // 自动轮播：每 6 秒切换
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % HERO_IMAGES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="hero">
      {/* ── 多图背景层 ── */}
      {HERO_IMAGES.map((src, i) => (
        <div
          key={src}
          className={`hero-slide ${i === currentIndex ? 'hero-slide-active' : ''}`}
          style={{ animationDuration: i === currentIndex ? '18s' : '0s' }}
        >
          <img src={src} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }} />
        </div>
      ))}

      {/* ── 遮罩层 ── */}
      <div className="hero-overlay" />
      <div className="hero-gradient" />

      {/* ── 文字（居中 + 依次淡入） ── */}
      <div className="hero-content">
        <p className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.1s',
          fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 32 }}>
          100% Pure Mulberry Silk · Handcrafted
        </p>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 7vw, 88px)',
          fontWeight: 300, lineHeight: 1.05, color: '#fff', marginBottom: 36,
          display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.3s', display: 'block' }}>
            Woven from
          </span>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.55s', display: 'block', fontStyle: 'italic', color: 'var(--gold)' }}>
            nature's finest
          </span>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.8s', display: 'block' }}>
            thread
          </span>
        </h1>

        <p className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.1s',
          fontSize: 14, lineHeight: 2, color: 'rgba(255,255,255,0.65)', maxWidth: 420, marginBottom: 48, textAlign: 'center' }}>
          Each ribbon carries the quiet beauty of silk in its most natural form — hand-treated, botanically inspired, made to last.
        </p>

        <div className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.4s' }}>
          <Link href="/collections">
            <button className="hero-btn">
              <span className="hero-btn-line" />
              Explore Collections
              <span className="hero-btn-line" />
            </button>
          </Link>
        </div>

        {/* 向下滚动提示 */}
        <div className={`hero-scroll-wrap hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.8s' }}>
          <div className="hero-scroll-line" />
        </div>
      </div>

      <style>{`
        .hero {
          position: relative; height: 100vh; height: 100dvh;
          min-height: 600px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: #1C1714;
        }

        /* ── 图片轮播层 ── */
        .hero-slide {
          position: absolute; inset: 0; z-index: 0;
          opacity: 0;
          transition: opacity 1.5s ease-in-out;
        }
        .hero-slide-active {
          opacity: 1;
          animation: kenBurns 18s ease-out forwards;
        }
        @keyframes kenBurns {
          0%   { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        .hero-overlay {
          position: absolute; inset: 0; z-index: 1;
          background: rgba(28, 23, 20, 0.45);
        }
        .hero-gradient {
          position: absolute; bottom: 0; left: 0; right: 0; z-index: 1;
          height: 40%;
          background: linear-gradient(to top, rgba(28,23,20,0.6) 0%, transparent 100%);
        }

        .hero-content {
          position: relative; z-index: 2;
          text-align: center; padding: 0 24px; max-width: 800px;
          display: flex; flex-direction: column; align-items: center;
        }

        /* ── 文字淡入动画 ── */
        .hero-anim {
          opacity: 0; transform: translateY(28px);
          transition: opacity 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      transform 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .hero-in { opacity: 1 !important; transform: translateY(0) !important; }

        /* ── CTA 按钮 ── */
        .hero-btn {
          background: none; border: 1px solid rgba(255,255,255,0.3);
          color: #fff; font-family: var(--font-body);
          font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
          padding: 18px 48px; display: inline-flex; align-items: center; gap: 20px;
          cursor: pointer; transition: all 0.4s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .hero-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: var(--gold); color: var(--gold);
        }
        .hero-btn-line {
          display: block; width: 28px; height: 1px;
          background: var(--gold); transition: width 0.4s ease;
        }
        .hero-btn:hover .hero-btn-line { width: 40px; }

        /* ── 滚动提示 ── */
        .hero-scroll-wrap {
          position: absolute; bottom: 40px; left: 50%;
          margin-left: -0.5px;
        }
        .hero-scroll-line {
          width: 1px; height: 48px;
          background: linear-gradient(to bottom, var(--gold), transparent);
          animation: scrollPulse 2s ease-in-out infinite;
        }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50%      { opacity: 1;   transform: scaleY(1.15); }
        }

        @media (max-width: 768px) {
          .hero { min-height: 100vh; min-height: 100dvh; }
          .hero-btn { padding: 16px 32px; font-size: 9px; }
          .hero-btn-line { width: 20px; }
          .hero-scroll-wrap { bottom: 24px; }
          .hero-scroll-line { height: 32px; }
        }
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


/* ═══════════════════════════════════════════════════════
   COLLECTIONS — Supabase 真实产品图
   ═══════════════════════════════════════════════════════ */
function Collections({ collectionImages }) {
  return (
    <section className="collections-section">
      <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 80px)', padding: '0 var(--page-padding, 60px)' }} className="reveal">
        <span className="eyebrow">Our Collections</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 300, marginTop: 20 }}>
          Six expressions of <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>pure silk</em>
        </h2>
      </div>
      <div className="collections-grid">
        {COLLECTIONS.map(c => {
          const img = collectionImages[c.slug]
          const fallbackBg = COLLECTION_FALLBACK_BG[c.slug] || 'var(--sand)'
          return (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="col-card" style={{ textDecoration: 'none' }}>
              <div className="col-card-inner" style={{ background: fallbackBg }}>
                {img && (
                  <img src={img} alt={c.name} className="col-img-inner"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', display: 'block',
                      transition: 'transform 1s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
                )}
                <div className="col-overlay" style={{
                  position: 'absolute', inset: 0, background: 'rgba(28,23,20,0.40)',
                  transition: 'opacity 0.5s ease' }} />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20, textAlign: 'center' }}>
                  <span style={{ color: '#fff', fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(20px, 2.2vw, 28px)', fontWeight: 300, marginBottom: 8, lineHeight: 1.2 }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
                    {c.count}
                  </span>
                  <span className="col-cta-line" style={{ display: 'block', width: 24, height: 1,
                    background: 'var(--gold)', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      <style>{`
        .collections-section { padding: var(--section-padding-y, 100px) 0; }
        .collections-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 3px; padding: 0 var(--page-padding, 60px);
        }
        .col-card-inner { position: relative; overflow: hidden; height: 420px; }
        @media (max-width: 900px) {
          .collections-grid { grid-template-columns: repeat(2, 1fr); gap: 2px; padding: 0 2px; }
          .col-card-inner { height: 260px; }
        }
        @media (max-width: 480px) { .col-card-inner { height: 200px; } }
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
        .story-section { padding: var(--section-padding-y, 120px) 0; background: var(--cream); text-align: center; }
        .story-inner { max-width: 800px; margin: 0 auto; padding: 0 var(--page-padding, 40px); }
      `}</style>
    </section>
  )
}


function FeaturedProducts({ products, loading }) {
  return (
    <section className="featured-section">
      <div className="featured-header">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300 }}>
          Artisan <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>Favourites</em>
        </h2>
        <Link href="/collections" className="btn-text"><span className="line" />View All</Link>
      </div>
      <div className="featured-grid">
        {products.map(p => (
          <Link key={p.id} href={`/products/${p.slug}`} style={{ textDecoration: 'none' }} className="prod-card">
            <div style={{ aspectRatio: '1/1', background: 'var(--sand)', marginBottom: 16, overflow: 'hidden', position: 'relative' }}>
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
        .featured-section { padding: var(--section-padding-y, 100px) var(--page-padding, 60px); background: var(--mist); }
        .featured-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 48px; flex-wrap: wrap; gap: 16px; }
        .featured-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .featured-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) {
          .featured-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .featured-header { margin-bottom: 32px; }
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
        .newsletter-section { padding: var(--section-padding-y, 100px) var(--page-padding, 60px); background: var(--deep); color: #fff; text-align: center; }
        .newsletter-inner { max-width: 500px; margin: 0 auto; }
        .newsletter-form { display: flex; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 12px; gap: 12px; }
        @media (max-width: 480px) {
          .newsletter-form { flex-direction: column; border-bottom: none; gap: 16px; }
          .newsletter-form input { border-bottom: 1px solid rgba(255,255,255,0.2) !important; padding-bottom: 12px; }
          .newsletter-form button { border: 1px solid rgba(255,255,255,0.2) !important; padding: 14px !important; }
        }
      `}</style>
    </section>
  )
}
