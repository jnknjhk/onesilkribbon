'use client'
import { COLLECTION_META } from '@/config/site'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@osr/core/lib/supabase'


function safe(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function safeNum(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

export default function CollectionClient({ initialProducts, slug: initialSlug, initialHeroImage = null }) {
  const [slug, setSlug] = useState(initialSlug || '')
  const [products, setProducts] = useState(initialProducts || [])
  const [loading, setLoading] = useState(initialProducts === undefined)
  const [sort, setSort] = useState('default')
  const [heroVisible, setHeroVisible] = useState(false)
  const [heroImg, setHeroImg] = useState(initialHeroImage)

// Hero image loaded server-side via initialHeroImage prop

  useEffect(() => {
    if (!slug) return
    // Skip client fetch if SSR already provided products — checking the prop was passed at all,
    // not its length, so a genuinely empty collection doesn't trigger a pointless refetch
    if (initialProducts !== undefined) {
      setLoading(false)
      return
    }
    async function load() {
      setLoading(true)
      try {
        const { data: prods, error } = await supabase
          .from('products')
          .select('id, name, slug, images, is_featured, collection')
          .eq('collection', slug)
          .eq('is_active', true)

        if (error) throw error

        const enriched = await Promise.all((prods || []).map(async (p) => {
          try {
            const { data: skus } = await supabase
              .from('product_skus')
              .select('price_gbp, colour, colour_hex, id, stock_qty')
              .eq('product_id', p.id)
              .order('price_gbp', { ascending: true })

            const skuList = skus || []
            const lowestPrice = safeNum(skuList[0]?.price_gbp)
            const firstSku = skuList[0] || null
            return { ...p, lowestPrice, firstSku }
          } catch {
            return { ...p, lowestPrice: 0, firstSku: null }
          }
        }))

        setProducts(enriched)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  const meta = COLLECTION_META[slug] || { name: slug, desc: '', bg: 'var(--sand)', hero: null }

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price-asc')  return a.lowestPrice - b.lowestPrice
    if (sort === 'price-desc') return b.lowestPrice - a.lowestPrice
    if (sort === 'name')       return safe(a.name).localeCompare(safe(b.name))
    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
  })

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Hero */}
      <div className="coll-hero" style={{
        background: heroImg
          ? `url(${heroImg}) center/cover no-repeat`
          : meta.bg,
        paddingTop: 100,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: heroImg
            ? 'linear-gradient(to bottom, rgba(28,23,20,0.35) 0%, rgba(28,23,20,0.55) 100%)'
            : 'rgba(28,23,20,0.28)',
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          textAlign: 'center', padding: '0 24px',
          maxWidth: 640, margin: '0 auto',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.9s ease, transform 0.9s ease',
        }}>
          <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>
            <Link href="/collections" style={{ color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={e => e.target.style.color = 'rgba(184,155,106,0.9)'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.55)'}>
              Collections
            </Link>
            <span style={{ margin: '0 10px', opacity: 0.4 }}>—</span>
            {meta.name}
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px,5.5vw,72px)',
            fontWeight: 300, color: '#fff',
            lineHeight: 1.1, marginBottom: 24,
            letterSpacing: '0.01em',
          }}>
            {meta.name}
          </h1>

          <div style={{
            width: heroVisible ? 56 : 0, height: 1,
            background: 'var(--gold)', margin: '0 auto 24px',
            transition: 'width 1.1s ease 0.4s',
          }} />

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.9, maxWidth: 460, margin: '0 auto',
            opacity: heroVisible ? 1 : 0,
            transition: 'opacity 0.9s ease 0.3s',
          }}>
            {meta.desc}
          </p>
        </div>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 80,
          background: 'linear-gradient(to bottom, transparent, var(--cream))',
        }} />
      </div>

      {/* Toolbar */}
      <div className="coll-toolbar">
        <span style={{ fontSize: 11, color: 'var(--taupe)', letterSpacing: '0.08em' }}>
          {loading ? '' : `${sorted.length} ${sorted.length === 1 ? 'product' : 'products'}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{
            fontSize: 12, color: 'var(--deep)', background: 'transparent',
            border: '1px solid var(--warm)', padding: '8px 14px',
            cursor: 'pointer', outline: 'none',
          }}>
            <option value="default">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="coll-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: 'var(--taupe)' }}>Loading collection…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>No products found</p>
          </div>
        ) : (
          <div className="prod-grid">
            {sorted.map((p) => (
              <ProductCard key={safe(p.id)} product={p} />
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .coll-hero {
          position: relative;
          height: clamp(380px, 48vw, 520px);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .coll-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px var(--page-padding, 48px);
          border-bottom: 1px solid var(--sand);
          flex-wrap: wrap; gap: 12px;
        }
        .coll-content {
          padding: 48px var(--page-padding, 48px) 120px;
        }
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 36px 28px;
        }
        @media(max-width:1100px) { .prod-grid { grid-template-columns: repeat(3,1fr); } }
        @media(max-width:768px) {
          .prod-grid { grid-template-columns: repeat(2,1fr); gap: 20px 14px; }
          .coll-content { padding: 32px 20px 80px; }
          .coll-toolbar { padding: 16px 20px; }
        }
        @media(max-width:480px) { .prod-grid { gap: 16px 10px; } }
      ` }} />
    </div>
  )
}

function ProductCard({ product: p }) {
  const [hovered, setHovered] = useState(false)
  const img   = Array.isArray(p.images) ? p.images[0] : null
  const price = safeNum(p.lowestPrice)
  const name  = safe(p.name)
  const slug  = safe(p.slug)

  return (
    <Link
      href={`/collections/${safe(p.collection)}/${slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        {/* 图片 */}
        <div style={{
          aspectRatio: '1/1', overflow: 'hidden',
          background: 'var(--sand)', marginBottom: 14,
          position: 'relative',
        }}>
          {img ? (
            <Image src={img} alt={name} fill sizes="(max-width: 768px) 50vw, 25vw" style={{
              objectFit: 'cover',
              transform: hovered ? 'scale(1.07)' : 'scale(1)',
              transition: 'transform 1.2s cubic-bezier(0.25,0.46,0.45,0.94)',
            }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(170deg,#E8DDD0,#C4A882)',
              transform: hovered ? 'scale(1.07)' : 'scale(1)',
              transition: 'transform 1.2s cubic-bezier(0.25,0.46,0.45,0.94)',
            }} />
          )}

          {/* 金色光晕 */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(184,155,106,0.18) 0%, rgba(28,23,20,0.32) 100%)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.6s ease',
            pointerEvents: 'none',
          }} />
        </div>

        {/* 文字 */}
        <div style={{
          paddingBottom: 16,
          borderBottom: '1px solid',
          borderColor: hovered ? 'var(--gold)' : 'var(--sand)',
          transition: 'border-color 0.4s ease',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(14px,1.4vw,17px)',
            fontWeight: 400, lineHeight: 1.3, marginBottom: 6,
            color: hovered ? 'var(--gold)' : 'var(--ink)',
            transition: 'color 0.35s ease',
          }}>
            {name}
          </h3>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(14px,1.3vw,17px)',
            color: 'var(--gold)', fontWeight: 300,
          }}>
            {price > 0 ? `From £${price.toFixed(2)}` : ''}
          </p>
        </div>
      </div>
    </Link>
  )
}
