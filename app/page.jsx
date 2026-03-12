'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatGBP } from '@/lib/pricing'

// ── Collection data ──────────────────────
const COLLECTIONS = [
  { name: 'Fine Silk Ribbons',  slug: 'fine-silk-ribbons',        count: '30 colourways', desc: 'Our signature collection. Ultra-fine 100% mulberry silk ribbons in hand-selected colourways, from 2mm to 10mm.' },
  { name: 'Hand-Frayed',        slug: 'hand-frayed-silk-ribbons', count: '18 styles',     desc: 'Each ribbon is carefully hand-frayed to create an ethereal, softly textured edge — perfect for bouquets and fine craft.' },
  { name: 'Adornments',         slug: 'handcrafted-adornments',   count: '12 designs',    desc: 'Silk scrunchies, bows and decorative pieces — each made by hand from the same pure mulberry silk as our ribbons.' },
  { name: 'Patterned',          slug: 'patterned-ribbons',        count: '14 patterns',   desc: 'Botanical, geometric and heritage-inspired motifs printed on pure silk. Each design tells a story.' },
  { name: 'Studio Tools',       slug: 'studio-tools',             count: '8 essentials',  desc: 'Curated essentials for the ribbon-maker and florist — scissors, spools, and everything for a well-appointed studio.' },
  { name: 'Vintage-Inspired',   slug: 'vintage-inspired-ribbons', count: '16 styles',     desc: 'Heritage tones and antique-inspired textures, evoking the romance of a bygone era.' },
]

const COLLECTION_FALLBACK_BG = {
  'fine-silk-ribbons':        'linear-gradient(160deg,#D4C5B0,#9A8878,#C4A882)',
  'hand-frayed-silk-ribbons': 'linear-gradient(160deg,#E8C9B8,#C9A48A,#9A7A66)',
  'handcrafted-adornments':   'linear-gradient(160deg,#B8A898,#7A6A5A,#4A3A30)',
  'patterned-ribbons':        'linear-gradient(160deg,#C8D4C0,#8A9A80,#5A7050)',
  'studio-tools':             'linear-gradient(160deg,#D0D0C8,#9A9A90,#5A5A54)',
  'vintage-inspired-ribbons': 'linear-gradient(160deg,#D4B8C0,#9A7A84,#5A3A44)',
}

const JOURNAL_POSTS = [
  { slug: 'how-to-tie-a-silk-ribbon-bow', date: 'March 2026', category: 'Guide', title: 'How to Tie a Silk Ribbon Bow', excerpt: 'The perfect bow is slower than it looks. We share our studio method — and the small adjustments that make all the difference.' },
  { slug: 'choosing-the-right-ribbon-width', date: 'February 2026', category: 'Guide', title: 'Choosing the Right Ribbon Width', excerpt: 'From 4mm to 38mm, every width has its ideal use. A practical guide to matching ribbon to occasion.' },
  { slug: 'the-story-behind-our-colours', date: 'January 2026', category: 'Behind the Scenes', title: 'The Story Behind Our Colours', excerpt: 'How we develop each colourway — from initial dye tests to the final name. Some colours take months to get right.' },
]

const HERO_IMAGES = [
  '/images/hero-1.jpg',
  '/images/hero-2.jpg',
  '/images/hero-3.jpg',
  '/images/hero-4.jpg',
]

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [collectionImages, setCollectionImages] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const imgMap = {}
      for (const col of COLLECTIONS) {
        const { data: colProds } = await supabase
          .from('products').select('images')
          .eq('collection', col.slug).eq('is_active', true).limit(3)
        if (colProds) {
          for (const p of colProds) {
            const imgs = Array.isArray(p.images) ? p.images : []
            if (imgs.length > 0) { imgMap[col.slug] = imgs[0]; break }
          }
        }
      }
      setCollectionImages(imgMap)

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
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('.reveal')
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
      }, { threshold: 0.08 })
      els.forEach(el => obs.observe(el))
      return () => obs.disconnect()
    }, 100)
    return () => clearTimeout(timer)
  }, [featuredProducts])

  return (
    <>
      <Hero />
      <Marquee />
      <Collections collectionImages={collectionImages} />
      <StorySection />
      <FeaturedProducts products={featuredProducts} loading={loading} />
      <JournalSection />
      <NewsletterSection />

      <style>{`
        .reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.9s ease, transform 0.9s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .prod-card:hover .prod-img-inner { transform: scale(1.04); }
      `}</style>
    </>
  )
}


/* ═══════════════════════════════════
   HERO — 多图交叉淡入淡出
   ═══════════════════════════════════ */
function Hero() {
  const [loaded, setLoaded] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % HERO_IMAGES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="hero">
      {HERO_IMAGES.map((src, i) => (
        <div key={src} className={`hero-slide ${i === currentIndex ? 'hero-slide-active' : ''}`}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ))}
      <div className="hero-overlay" />
      <div className="hero-gradient" />

      <div className="hero-content">
        <p className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.1s', fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 32 }}>
          100% Pure Mulberry Silk · Handcrafted
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 7vw, 88px)', fontWeight: 300, lineHeight: 1.05, color: '#fff', marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.3s', display: 'block' }}>Woven from</span>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.55s', display: 'block', fontStyle: 'italic', color: 'var(--gold)' }}>nature's finest</span>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.8s', display: 'block' }}>thread</span>
        </h1>
        <p className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.1s', fontSize: 14, lineHeight: 2, color: 'rgba(255,255,255,0.65)', maxWidth: 420, marginBottom: 48, textAlign: 'center' }}>
          Each ribbon carries the quiet beauty of silk in its most natural form — hand-treated, botanically inspired, made to last.
        </p>
        <div className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.4s' }}>
          <Link href="/collections"><button className="hero-btn"><span className="hero-btn-line" />Explore Collections<span className="hero-btn-line" /></button></Link>
        </div>
        <div className={`hero-scroll-wrap hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.8s' }}>
          <div className="hero-scroll-line" />
        </div>
      </div>

      <style>{`
        .hero { position: relative; height: 100vh; height: 100dvh; min-height: 600px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #1C1714; }
        .hero-slide { position: absolute; inset: 0; z-index: 0; opacity: 0; transition: opacity 1.5s ease-in-out; }
        .hero-slide-active { opacity: 1; animation: kenBurns 18s ease-out forwards; }
        @keyframes kenBurns { 0% { transform: scale(1.08); } 100% { transform: scale(1); } }
        .hero-overlay { position: absolute; inset: 0; z-index: 1; background: rgba(28,23,20,0.45); }
        .hero-gradient { position: absolute; bottom: 0; left: 0; right: 0; z-index: 1; height: 40%; background: linear-gradient(to top, rgba(28,23,20,0.6), transparent); }
        .hero-content { position: relative; z-index: 2; text-align: center; padding: 0 24px; max-width: 800px; display: flex; flex-direction: column; align-items: center; }
        .hero-anim { opacity: 0; transform: translateY(28px); transition: opacity 0.9s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94); }
        .hero-in { opacity: 1 !important; transform: translateY(0) !important; }
        .hero-btn { background: none; border: 1px solid rgba(255,255,255,0.3); color: #fff; font-family: var(--font-body); font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; padding: 18px 48px; display: inline-flex; align-items: center; gap: 20px; cursor: pointer; transition: all 0.4s ease; }
        .hero-btn:hover { background: rgba(255,255,255,0.08); border-color: var(--gold); color: var(--gold); }
        .hero-btn-line { display: block; width: 28px; height: 1px; background: var(--gold); transition: width 0.4s ease; }
        .hero-btn:hover .hero-btn-line { width: 40px; }
        .hero-scroll-wrap { position: absolute; bottom: 40px; left: 50%; margin-left: -0.5px; }
        .hero-scroll-line { width: 1px; height: 48px; background: linear-gradient(to bottom, var(--gold), transparent); animation: scrollPulse 2s ease-in-out infinite; }
        @keyframes scrollPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @media (max-width: 768px) { .hero-btn { padding: 16px 32px; font-size: 9px; } .hero-scroll-wrap { bottom: 24px; } .hero-scroll-line { height: 32px; } }
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
   COLLECTIONS — 左右交替布局
   ═══════════════════════════════════ */
function Collections({ collectionImages }) {
  return (
    <section style={{ padding: 'var(--section-padding-y, 100px) 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 'clamp(48px, 6vw, 80px)', padding: '0 var(--page-padding, 60px)' }} className="reveal">
        <span className="eyebrow">Our Collections</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 300, marginTop: 20 }}>
          Six expressions of <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>pure silk</em>
        </h2>
      </div>

      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 var(--page-padding, 60px)' }}>
        {COLLECTIONS.map((c, i) => {
          const img = collectionImages[c.slug]
          const fallback = COLLECTION_FALLBACK_BG[c.slug]
          const isEven = i % 2 === 1

          return (
            <Link key={c.slug} href={`/collections/${c.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div className={`reveal col-row ${isEven ? 'col-row-reverse' : ''}`}>
                {/* 图片 */}
                <div className="col-row-img" style={{ background: fallback }}>
                  {img && (
                    <img src={img} alt={c.name} className="col-row-img-inner"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
                  )}
                </div>

                {/* 文字 */}
                <div className="col-row-text">
                  <span style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16, display: 'block' }}>
                    {c.count}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 3.5vw, 42px)', fontWeight: 300, color: 'var(--ink)', marginBottom: 20, lineHeight: 1.2 }}>
                    {c.name}
                  </h3>
                  <p style={{ fontSize: 15, color: 'var(--taupe)', lineHeight: 2, marginBottom: 28 }}>
                    {c.desc}
                  </p>
                  <span className="col-row-cta">
                    <span className="col-row-cta-line" />
                    Shop Collection
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <style>{`
        .col-row {
          display: grid; grid-template-columns: 2fr 3fr;
          gap: 0; margin-bottom: clamp(16px, 3vw, 32px);
          overflow: hidden; min-height: 220px;
        }
        .col-row-reverse { direction: rtl; }
        .col-row-reverse > * { direction: ltr; }

        .col-row-img {
          overflow: hidden; position: relative;
          min-height: 200px;
        }
        .col-row:hover .col-row-img-inner { transform: scale(1.05); }

        .col-row-text {
          display: flex; flex-direction: column; justify-content: center;
          padding: clamp(32px, 5vw, 72px);
        }

        .col-row-cta {
          display: inline-flex; align-items: center; gap: 14px;
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--deep);
        }
        .col-row-cta-line {
          width: 28px; height: 1px; background: var(--gold);
          display: inline-block; transition: width 0.4s ease;
        }
        .col-row:hover .col-row-cta-line { width: 48px; }
        .col-row:hover .col-row-cta { color: var(--gold); }

        @media (max-width: 768px) {
          .col-row { grid-template-columns: 1fr; min-height: auto; }
          .col-row-reverse { direction: ltr; }
          .col-row-img { min-height: 180px; }
          .col-row-text { padding: 28px 24px 36px; }
        }
      `}</style>
    </section>
  )
}


/* ═══════════════════════════════════
   STORY SECTION
   ═══════════════════════════════════ */
function StorySection() {
  return (
    <section style={{ background: 'var(--sand)', overflow: 'hidden' }}>
      <div className="story-row reveal">
        <div className="story-img">
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #D4C5B0, #9A8878, #C4A882)' }} />
        </div>
        <div className="story-text">
          <span className="eyebrow" style={{ marginBottom: 20 }}>Our Story</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300, marginBottom: 28, lineHeight: 1.2, color: 'var(--ink)' }}>
            Made by hand.<br /><em style={{ fontStyle: 'italic' }}>Made with intention.</em>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 2, marginBottom: 20 }}>
            One Silk Ribbon began with a simple frustration: the impossibility of finding a ribbon that felt truly beautiful. We started with a single bolt of Grade 6A mulberry silk and a pair of hands.
          </p>
          <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 2, marginBottom: 40 }}>
            Today we offer over 200 colourways across six collections — all made with the same quiet care as that very first yard.
          </p>
          <Link href="/about" className="btn-text"><span className="line" />Read Our Story</Link>
        </div>
      </div>

      <style>{`
        .story-row {
          display: grid; grid-template-columns: 1fr 1fr;
          max-width: 1360px; margin: 0 auto;
          min-height: 560px;
        }
        .story-img { overflow: hidden; }
        .story-text {
          display: flex; flex-direction: column; justify-content: center;
          padding: clamp(40px, 6vw, 80px);
        }
        @media (max-width: 768px) {
          .story-row { grid-template-columns: 1fr; }
          .story-img { min-height: 300px; }
          .story-text { padding: 40px 24px 60px; }
        }
      `}</style>
    </section>
  )
}


/* ═══════════════════════════════════
   FEATURED PRODUCTS
   ═══════════════════════════════════ */
function FeaturedProducts({ products, loading }) {
  return (
    <section className="featured-section">
      <div className="featured-header reveal">
        <div>
          <span className="eyebrow" style={{ marginBottom: 16 }}>Artisan Picks</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300 }}>
            Our <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>Favourites</em>
          </h2>
        </div>
        <Link href="/collections" className="btn-text"><span className="line" />View All</Link>
      </div>
      <div className="featured-grid">
        {products.map(p => (
          <Link key={p.id} href={`/products/${p.slug}`} style={{ textDecoration: 'none' }} className="prod-card reveal">
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
        .featured-section { padding: var(--section-padding-y, 100px) var(--page-padding, 60px); background: var(--cream); }
        .featured-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 48px; flex-wrap: wrap; gap: 16px; }
        .featured-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .featured-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) { .featured-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; } .featured-header { margin-bottom: 32px; } }
      `}</style>
    </section>
  )
}


/* ═══════════════════════════════════
   JOURNAL — 博客卡片区域
   ═══════════════════════════════════ */
function JournalSection() {
  return (
    <section className="journal-section">
      <div className="journal-header reveal" style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 64px)' }}>
        <span className="eyebrow" style={{ marginBottom: 16 }}>The Journal</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300, marginTop: 12 }}>
          Stories from the <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>Atelier</em>
        </h2>
      </div>

      <div className="journal-grid">
        {JOURNAL_POSTS.map((post, i) => (
          <Link key={post.slug} href={`/journal/${post.slug}`} style={{ textDecoration: 'none' }}>
            <div className={`journal-card reveal`} style={{ transitionDelay: `${i * 0.12}s` }}>
              {/* 卡片顶部图片区域 — 用渐变色占位，以后可以换成真实图片 */}
              <div className="journal-card-img">
                <div style={{
                  width: '100%', height: '100%',
                  background: [
                    'linear-gradient(135deg, #E8DDD0, #C4A882)',
                    'linear-gradient(135deg, #D4C5B0, #9A8878)',
                    'linear-gradient(135deg, #E8C9B8, #9A7A66)',
                  ][i % 3],
                }} />
              </div>

              <div className="journal-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gold)' }}>{post.category}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--warm)' }} />
                  <span style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '0.05em' }}>{post.date}</span>
                </div>

                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 2vw, 22px)', fontWeight: 300, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.3 }}>
                  {post.title}
                </h3>

                <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.9, marginBottom: 20 }}>
                  {post.excerpt}
                </p>

                <span className="journal-card-link">
                  Read More →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="reveal" style={{ textAlign: 'center', marginTop: 'clamp(32px, 4vw, 56px)' }}>
        <Link href="/journal" className="btn-text"><span className="line" />View All Articles</Link>
      </div>

      <style>{`
        .journal-section {
          padding: var(--section-padding-y, 100px) var(--page-padding, 60px);
          background: var(--mist);
        }
        .journal-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: clamp(20px, 3vw, 36px);
          max-width: 1360px; margin: 0 auto;
        }
        .journal-card {
          background: var(--cream);
          overflow: hidden;
          transition: transform 0.4s ease, box-shadow 0.4s ease;
        }
        .journal-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.08);
        }
        .journal-card-img {
          aspect-ratio: 16/10; overflow: hidden;
        }
        .journal-card-img > div {
          transition: transform 0.6s ease;
        }
        .journal-card:hover .journal-card-img > div {
          transform: scale(1.05);
        }
        .journal-card-body {
          padding: clamp(20px, 2.5vw, 28px);
        }
        .journal-card-link {
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--gold); transition: color 0.3s;
        }
        .journal-card:hover .journal-card-link { color: var(--ink); }

        @media (max-width: 900px) { .journal-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .journal-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}


/* ═══════════════════════════════════
   NEWSLETTER
   ═══════════════════════════════════ */
function NewsletterSection() {
  return (
    <section className="newsletter-section">
      <div className="newsletter-inner reveal">
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
