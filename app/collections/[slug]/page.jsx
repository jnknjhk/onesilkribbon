'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatGBP } from '@/lib/pricing'
import { useCart } from '@/lib/cart'
import { use } from 'react'

const COLLECTION_META = {
  'fine-silk-ribbons':        { name: 'Fine Silk Ribbons',       desc: 'Our signature ultra-fine 100% mulberry silk ribbons, in widths from 2mm to 10mm and 30 hand-selected colourways.', bg: 'linear-gradient(135deg,#D4C5B0,#9A8878)' },
  'hand-frayed-silk-ribbons': { name: 'Hand-Frayed Silk Ribbons', desc: 'Each edge carefully frayed by hand for an ethereal, organic finish — beautiful for bouquets, invitations and fine craft.', bg: 'linear-gradient(135deg,#E8C9B8,#9A7A66)' },
  'handcrafted-adornments':   { name: 'Handcrafted Adornments',  desc: 'Silk scrunchies, bows and decorative pieces — each made by hand from pure mulberry silk.', bg: 'linear-gradient(135deg,#B8A898,#4A3A30)' },
  'patterned-ribbons':        { name: 'Patterned Ribbons',       desc: 'Botanical, geometric and heritage-inspired patterns printed on pure silk.', bg: 'linear-gradient(135deg,#C8D4C0,#5A7050)' },
  'studio-tools':             { name: 'Studio Tools',            desc: 'Everything you need for a well-appointed ribbon and craft studio.', bg: 'linear-gradient(135deg,#D0D0C8,#5A5A54)' },
  'vintage-inspired-ribbons': { name: 'Vintage-Inspired Ribbons', desc: 'Heritage tones and antique-inspired textures, evoking the romance of a bygone era.', bg: 'linear-gradient(135deg,#D4B8C0,#5A3A44)' },
}

// Widths for filter
const WIDTH_OPTIONS = [2, 4, 7, 10, 16, 25, 38, 50]

// Sample products (replaced by DB queries in production)
const SAMPLE_PRODUCTS = Array.from({ length: 12 }, (_, i) => ({
  id: `prod-${i}`,
  name: `Silk Ribbon ${i + 1}`,
  slug: `silk-ribbon-${i + 1}`,
  price: parseFloat((5.90 + i * 1.5).toFixed(2)),
  details: `${[2,4,7,10][i%4]}mm · 10m Spool`,
  badge: i === 0 ? 'Bestseller' : i === 2 ? 'New' : null,
  bg: ['linear-gradient(170deg,#E8DDD0,#C4A882)','linear-gradient(170deg,#E8C9B8,#C9A48A)','linear-gradient(170deg,#C8D4C0,#8A9A80)','linear-gradient(170deg,#D4B8C0,#9A7A84)'][i % 4],
  swatches: ['#F0EAE0','#E8C9B8','#B89B6A','#9A8878'],
  widthMm: [2,4,7,10][i%4],
  colour: ['Antique Lace','Blush Petal','Gold Dust','Driftwood'][i%4],
}))

export default function CollectionPage({ params }) {
  const { slug } = use(params)
  const meta = COLLECTION_META[slug] || { name: slug, desc: '', bg: 'var(--sand)' }

  const [products, setProducts] = useState(SAMPLE_PRODUCTS)
  const [sort, setSort] = useState('default')
  const [filterWidth, setFilterWidth] = useState(null)
  const [view, setView] = useState('grid') // grid | list
  const { addItem } = useCart()

  // Sort
  const sorted = [...products].sort((a, b) => {
    if (sort === 'price-asc')  return a.price - b.price
    if (sort === 'price-desc') return b.price - a.price
    if (sort === 'name')       return a.name.localeCompare(b.name)
    return 0
  }).filter(p => filterWidth ? p.widthMm === filterWidth : true)

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
          {/* Breadcrumb */}
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
        {/* Width filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Width</span>
          <button onClick={() => setFilterWidth(null)} style={{
            padding: '6px 14px', border: `1px solid ${!filterWidth ? 'var(--deep)' : 'var(--warm)'}`,
            background: !filterWidth ? 'var(--deep)' : 'transparent',
            color: !filterWidth ? '#fff' : 'var(--deep)',
            fontSize: 11, letterSpacing: '0.08em',
          }}>All</button>
          {WIDTH_OPTIONS.map(w => (
            <button key={w} onClick={() => setFilterWidth(filterWidth === w ? null : w)} style={{
              padding: '6px 12px', border: `1px solid ${filterWidth === w ? 'var(--deep)' : 'var(--warm)'}`,
              background: filterWidth === w ? 'var(--deep)' : 'transparent',
              color: filterWidth === w ? '#fff' : 'var(--deep)',
              fontSize: 11,
            }}>{w}mm</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Sort */}
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

          {/* Count */}
          <span style={{ fontSize: 11, color: 'var(--taupe)' }}>{sorted.length} products</span>
        </div>
      </div>

      {/* Products grid */}
      <div style={{ padding: '48px 60px 120px' }} className="prod-list-pad">
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>No products found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }} className="prod-list-grid">
            {sorted.map(p => (
              <ProductCard key={p.id} product={p} onAdd={() =>
                addItem({ skuId: p.id, productId: p.id, name: p.name, skuDesc: p.details, colour: p.colour, colourHex: p.swatches[0], price: p.price, qty: 1, image: null })
              } />
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
  return (
    <div className="prod-card-inner">
      <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: 'var(--sand)', marginBottom: 20, position: 'relative' }}>
        <div className="prod-card-img" style={{ width: '100%', height: '100%', background: p.bg, transition: 'transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
        {p.badge && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'var(--deep)', color: '#fff', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 10px' }}>
            {p.badge}
          </div>
        )}
        <button className="quick-add-btn" onClick={onAdd} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(28,23,20,0.9)', color: '#fff', border: 'none',
          padding: 14, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          transform: 'translateY(100%)', transition: 'transform 0.4s',
        }}>
          Add to Basket
        </button>
      </div>
      <Link href={`/products/${p.slug}`}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>{p.name}</h3>
        <p style={{ fontSize: 11, color: 'var(--taupe)', marginBottom: 10, letterSpacing: '0.04em' }}>{p.details}</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--deep)' }}>{formatGBP(p.price)}</p>
      </Link>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {p.swatches.map(hex => (
          <div key={hex} style={{ width: 12, height: 12, borderRadius: '50%', background: hex, border: '1px solid var(--warm)' }} />
        ))}
      </div>
    </div>
  )
}
