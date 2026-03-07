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

    // Scroll reveal
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
      <FeaturedProducts products={featuredProducts} loading={loading} />
      <StorySection />
      <JournalSection />
      <NewsletterSection />

      <style>{`
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.9s ease, transform 0.9s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .col-card:hover .col-img-inner { transform: scale(1.05); }
        .prod-card:hover .prod-img-inner { transform: scale(1.04); }
        .prod-card:hover .quick-add { transform: translateY(0) !important; }
      `}</style>
    </>
  )
}

function Hero() {
  return (
    <section style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }} className="hero-section">
      <div style={{ background: 'var(--sand)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 80px 100px 80px', position: 'relative' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(52px,6vw,86px)', fontWeight: 300, lineHeight: 1.05, color: 'var(--ink)', marginBottom: 32 }}>
          Woven from  
<em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>nature's</em>  
finest thread
        </h1>
        <Link href="/collections"><button className="btn-text"><span className="line" />Explore Collections</button></Link>
      </div>
      <div style={{ background: '#2A2420', position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1C1714,#3D3530,#6B5A4E,#9A8878,#C4A882,#E8DDD0)' }} />
      </div>
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

function Collections() {
  return (
    <section style={{ padding: '120px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 80 }} className="reveal">
        <span className="eyebrow">Our Collections</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 300, marginTop: 20 }}>Six expressions of <em>pure silk</em></h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: '0 60px' }}>
        {COLLECTIONS.map(c => (
          <Link key={c.slug} href={`/collections/${c.slug}`} style={{ height: 400, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} className="col-card">
            <span style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: 24 }}>{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function FeaturedProducts({ products, loading }) {
  return (
    <section style={{ padding: '120px 60px', background: 'var(--mist)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 60 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 300 }}>Artisan <em>Favourites</em></h2>
        <Link href="/collections" className="btn-text"><span className="line" />View All</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }}>
        {products.map(p => (
          <Link key={p.id} href={`/products/${p.slug}`} style={{ textDecoration: 'none' }} className="prod-card">
            <div style={{ aspectRatio: '3/4', background: 'var(--sand)', marginBottom: 20, overflow: 'hidden' }}>
              {p.images?.[0] && <img src={p.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{p.name}</h3>
            <p style={{ fontSize: 14, color: 'var(--taupe)', marginTop: 8 }}>From {formatGBP(p.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function StorySection() { return null }
function JournalSection() { return null }
function NewsletterSection() { return null }
