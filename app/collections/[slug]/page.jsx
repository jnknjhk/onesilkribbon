'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { formatGBP } from '@/lib/pricing'
import { useCart } from '@/lib/cart'
import { use } from 'react'

const COLLECTION_META = {
  'fine-silk-ribbons':        { name: 'Fine Silk Ribbons',        desc: 'Our signature ultra-fine 100% mulberry silk ribbons, in widths from 2mm to 10mm and 30 hand-selected colourways.', bg: 'linear-gradient(135deg,#D4C5B0,#9A8878)' },
  'hand-frayed-silk-ribbons': { name: 'Hand-Frayed Silk Ribbons', desc: 'Each edge carefully frayed by hand for an ethereal, organic finish — beautiful for bouquets, invitations and fine craft.', bg: 'linear-gradient(135deg,#E8C9B8,#9A7A66)' },
  'handcrafted-adornments':   { name: 'Handcrafted Adornments',   desc: 'Silk scrunchies, bows and decorative pieces — each made by hand from pure mulberry silk.', bg: 'linear-gradient(135deg,#B8A898,#4A3A30)' },
  'patterned-ribbons':        { name: 'Patterned Ribbons',        desc: 'Botanical, geometric and heritage-inspired patterns printed on pure silk.', bg: 'linear-gradient(135deg,#C8D4C0,#5A7050)' },
  'studio-tools':             { name: 'Studio Tools',             desc: 'Everything you need for a well-appointed ribbon and craft studio.', bg: 'linear-gradient(135deg,#D0D0C8,#5A5A54)' },
  'vintage-inspired-ribbons': { name: 'Vintage-Inspired Ribbons', desc: 'Heritage tones and antique-inspired textures, evoking the romance of a bygone era.', bg: 'linear-gradient(135deg,#D4B8C0,#5A3A44)' },
}

export default function CollectionPage({ params }) {
  const { slug } = use(params)
  const meta = COLLECTION_META[slug] || { name: slug, desc: '', bg: 'var(--sand)' }

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('default')
  const { addItem } = useCart()

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Fetch products in this collection
      const { data: prods, error } = await supabase
        .from('products')
        .select('id, name, slug, images, is_featured, collection')
        .eq('collection', slug)
        .eq('is_active', true)

      if (error) { console.error(error); setLoading(false); return }

      // For each product, get lowest price SKU
      const enriched = await Promise.all((prods || []).map(async (p) => {
        const { data: skus } = await supabase
          .from('product_skus')
          .select('price_gbp, colour, colour_hex, id, stock_qty')
          .eq('product_id', p.id)
          .order('price_gbp', { ascending: true })

        const lowestPrice = skus?.[0]?.price_gbp ?? 0
        const firstSku = skus?.[0] ?? null
        const swatches = [...new Map((skus || []).map(s => [s.colour_hex, s.colour_hex])).values()].slice(0, 5)

        return { ...p, lowestPrice, firstSku, swatches, skus: skus || [] }
      }))

      setProducts(enriched)
      setLoading(false)
    }
    load()
  }, [slug])

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price-asc')  return a.lowestPrice - b.lowestPrice
    if (sort === 'price-desc') return b.lowestPrice - a.lowestPrice
    if (sort === 'name')       return a.name.localeCompare(b.name)
    if (sort === 'default')    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
    return 0
  })

  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Hero banner */}
      <div style={{
        height: 360, background: meta.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,23,20,0.3)' }} />
        <div style={{ position: 'relative', textAlign: 'center', padding: '0 40px' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
            <Link href="/collections" style={{ color: 'inherit' }}>Collections</Link> / {meta.name}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,64px)', fontWeight: 300, color: '#fff', marginBottom: 20 }}>
            {meta.name}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', maxWidth: 480, lineHeight: 1.8 }}>
            {meta.desc}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 60px', borderBottom: '1px solid var(--sand)',
        flexWrap: 'wrap', gap: 16,
      }} className="toolbar-pad">
        <span style={{ fontSize: 11, color: 'var(--taupe)' }}>
          {loading ? 'Loading…' : `${sorted.length} products`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ fontSize: 12, color: 'var(--deep)', background: 'transparent', border: '1px solid var(--warm)', padding: '6px 12px' }}>
            <option value="default">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Products grid */}
      <div style={{ padding: '48px 60px 120px' }} className="prod-list-pad">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--taupe)' }}>Loading collection…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>No products found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }} className="prod-list-grid">
            {sorted.map(p => (
              <ProductCard key={p.id} product={p} onAdd={() => {
                if (p.firstSku) {
                  addItem({
                    skuId: p.firstSku.id,
                    productId: p.id,
                    name: p.name,
                    skuDesc: p.firstSku.colour,
                    colour: p.firstSku.colour,
                    colourHex: p.firstSku.colour_hex,
                    price: p.firstSku.price_gbp,
                    qty: 1,
                    image: p.images?.[0] || null,
                  })
                }
              }} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .prod-card-inner:hover .prod-card-img { transform: scale(1.04); }
        .prod-card-inner:hover .quick-add-btn { transform: translateY(0) !important; }
        @media(max-width:1100px){.prod-list-grid{grid-template-columns:repeat(3,1fr) !important}}
        @media(max-width:900px){.prod-list-grid{grid-template-columns:repeat(2,1fr) !important}}
        @media(max-width:600px){.prod-list-grid{grid-template-columns:1fr !important}.prod-list-pad,.toolbar-pad{padding-left:24px !important;padding-right:24px !important}}
      `}</style>
    </div>
  )
}

function ProductCard({ product: p, onAdd }) {
  const img = p.images?.[0]
  return (
    <div className="prod-card-inner">
      <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: 'var(--sand)', marginBottom: 20, position: 'relative' }}>
        {img ? (
          <img
            src={img}
            alt={p.name}
            className="prod-card-img"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)' }}
          />
        ) : (
          <div className="prod-card-img" style={{ width: '100%', height: '100%', background: 'linear-gradient(170deg,#E8DDD0,#C4A882)', transition: 'transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
        )}
        {p.is_featured && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'var(--deep)', color: '#fff', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 10px' }}>
            Featured
          </div>
        )}
        <button className="quick-add-btn" onClick={onAdd} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(28,23,20,0.9)', color: '#fff', border: 'none',
          padding: 14, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          transform: 'translateY(100%)', transition: 'transform 0.4s', cursor: 'pointer',
        }}>
          Add to Basket
        </button>
      </div>
      <Link href={`/products/${p.slug}`} style={{ textDecoration: 'none' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>{p.name}</h3>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--deep)', marginTop: 8 }}>
          {p.lowestPrice > 0 ? `From ${formatGBP(p.lowestPrice)}` : ''}
        </p>
      </Link>
      {p.swatches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {p.swatches.map((hex, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: hex, border: '1px solid var(--warm)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
