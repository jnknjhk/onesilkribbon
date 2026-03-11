'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'

const COLLECTION_META = {
  'fine-silk-ribbons':        { name: 'Fine Silk Ribbons',        desc: 'Our signature ultra-fine 100% mulberry silk ribbons, in widths from 2mm to 10mm and 30 hand-selected colourways.', bg: 'linear-gradient(135deg,#D4C5B0,#9A8878)' },
  'hand-frayed-silk-ribbons': { name: 'Hand-Frayed Silk Ribbons', desc: 'Each edge carefully frayed by hand for an ethereal, organic finish.', bg: 'linear-gradient(135deg,#E8C9B8,#9A7A66)' },
  'handcrafted-adornments':   { name: 'Handcrafted Adornments',   desc: 'Silk scrunchies, bows and decorative pieces — each made by hand from pure mulberry silk.', bg: 'linear-gradient(135deg,#B8A898,#4A3A30)' },
  'patterned-ribbons':        { name: 'Patterned Ribbons',        desc: 'Botanical, geometric and heritage-inspired patterns printed on pure silk.', bg: 'linear-gradient(135deg,#C8D4C0,#5A7050)' },
  'studio-tools':             { name: 'Studio Tools',             desc: 'Everything you need for a well-appointed ribbon and craft studio.', bg: 'linear-gradient(135deg,#D0D0C8,#5A5A54)' },
  'vintage-inspired-ribbons': { name: 'Vintage-Inspired Ribbons', desc: 'Heritage tones and antique-inspired textures.', bg: 'linear-gradient(135deg,#D4B8C0,#5A3A44)' },
}

function safe(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function safeNum(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

export default function CollectionPage({ params }) {
  const [slug, setSlug] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('default')
  const { addItem } = useCart()

  useEffect(() => {
    const parts = window.location.pathname.split('/')
    const s = parts[parts.length - 1] || ''
    setSlug(s)
  }, [])

  useEffect(() => {
    if (!slug) return
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
            const hexSeen = new Set()
            const swatches = []
            for (const s of skuList) {
              const hex = safe(s.colour_hex)
              if (hex && !hexSeen.has(hex) && swatches.length < 5) {
                hexSeen.add(hex)
                swatches.push(hex)
              }
            }
            return { ...p, lowestPrice, firstSku, swatches }
          } catch {
            return { ...p, lowestPrice: 0, firstSku: null, swatches: [] }
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

  const meta = COLLECTION_META[slug] || { name: slug, desc: '', bg: 'var(--sand)' }

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price-asc')  return a.lowestPrice - b.lowestPrice
    if (sort === 'price-desc') return b.lowestPrice - a.lowestPrice
    if (sort === 'name')       return safe(a.name).localeCompare(safe(b.name))
    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
  })

  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Hero */}
      <div className="coll-hero" style={{ background: meta.bg, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,23,20,0.3)' }} />
        <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px', maxWidth: 600, margin: '0 auto' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
            <Link href="/collections" style={{ color: 'inherit' }}>Collections</Link>{' / '}{meta.name}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,64px)', fontWeight: 300, color: '#fff', marginBottom: 20 }}>
            {meta.name}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', maxWidth: 480, lineHeight: 1.8, margin: '0 auto' }}>
            {meta.desc}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="coll-toolbar">
        <span style={{ fontSize: 11, color: 'var(--taupe)' }}>
          {loading ? 'Loading…' : `${sorted.length} products`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ fontSize: 12, color: 'var(--deep)', background: 'transparent', border: '1px solid var(--warm)', padding: '8px 12px' }}>
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
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--taupe)' }}>Loading collection…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>No products found</p>
          </div>
        ) : (
          <div className="prod-grid">
            {sorted.map(p => (
              <ProductCard
                key={safe(p.id)}
                product={p}
                onAdd={() => {
                  if (p.firstSku) {
                    addItem({
                      skuId: safe(p.firstSku.id),
                      productId: safe(p.id),
                      name: safe(p.name),
                      skuDesc: safe(p.firstSku.colour),
                      colour: safe(p.firstSku.colour),
                      colourHex: safe(p.firstSku.colour_hex),
                      price: safeNum(p.firstSku.price_gbp),
                      qty: 1,
                      image: Array.isArray(p.images) ? (p.images[0] || null) : null,
                    })
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .coll-hero {
          height: clamp(240px, 30vw, 360px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .coll-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px var(--page-padding, 24px);
          border-bottom: 1px solid var(--sand);
          flex-wrap: wrap; gap: 12px;
        }
        .coll-content {
          padding: 32px var(--page-padding, 24px) 100px;
        }
        .prod-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }
        .prod-card:hover .prod-img { transform: scale(1.04); }
        .prod-card:hover .quick-add { transform: translateY(0) !important; }
        @media(max-width:1100px) { .prod-grid { grid-template-columns: repeat(3, 1fr); } }
        @media(max-width:768px) {
          .prod-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .coll-content { padding: 24px 16px 80px; }
          .coll-toolbar { padding: 16px; }
          .quick-add { transform: translateY(0) !important; opacity: 0.95; }
        }
        @media(max-width:480px) {
          .prod-grid { gap: 12px; }
        }
      `}</style>
    </div>
  )
}

function ProductCard({ product: p, onAdd }) {
  const img = Array.isArray(p.images) ? p.images[0] : null
  const price = safeNum(p.lowestPrice)
  const name = safe(p.name)
  const slug = safe(p.slug)

  return (
    <div className="prod-card">
      <div style={{ aspectRatio: '1/1', overflow: 'hidden', background: 'var(--sand)', marginBottom: 12, position: 'relative' }}>
        {img ? (
          <img src={img} alt={name} className="prod-img"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.7s ease' }} />
        ) : (
          <div className="prod-img" style={{ width: '100%', height: '100%', background: 'linear-gradient(170deg,#E8DDD0,#C4A882)', transition: 'transform 0.7s ease' }} />
        )}
        <button className="quick-add" onClick={onAdd} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(28,23,20,0.9)', color: '#fff', border: 'none',
          padding: 14, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          transform: 'translateY(100%)', transition: 'transform 0.4s', cursor: 'pointer',
          minHeight: 44,
        }}>
          Add to Basket
        </button>
      </div>
      <Link href={`/products/${slug}`} style={{ textDecoration: 'none' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(14px, 1.5vw, 18px)', fontWeight: 400, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>
          {name}
        </h3>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 1.5vw, 20px)', color: 'var(--deep)', marginTop: 6 }}>
          {price > 0 ? `From £${price.toFixed(2)}` : ''}
        </p>
      </Link>
      {p.swatches && p.swatches.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          {p.swatches.map((hex, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: hex, border: '1px solid var(--warm)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
