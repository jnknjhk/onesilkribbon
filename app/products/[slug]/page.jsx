'use client'
import { useState, use } from 'react'
import Link from 'next/link'
import { formatGBP } from '@/lib/pricing'
import { useCart } from '@/lib/cart'

// Sample product data — replaced by DB in production
function getProduct(slug) {
  return {
    id: 'prod-001',
    name: 'Ultra-Fine Mulberry Silk Ribbon',
    slug,
    collection: 'Fine Silk Ribbons',
    collectionSlug: 'fine-silk-ribbons',
    description: `Crafted from 100% pure mulberry silk, this ultra-fine ribbon is our most-loved piece. Its natural lustre and incomparable softness make it ideal for bouquets, gift wrapping, jewellery-making, bookbinding, and any occasion that calls for a touch of genuine beauty.\n\nEach spool is carefully wound by hand and inspected before dispatch.`,
    care: 'Hand wash gently in cool water with a mild detergent. Lay flat or hang to dry. Do not tumble dry. Iron on silk setting if needed.',
    widths: [
      { mm: 2,  price: 5.90,  stock: 40 },
      { mm: 4,  price: 7.90,  stock: 35 },
      { mm: 7,  price: 9.90,  stock: 28 },
      { mm: 10, price: 11.90, stock: 20 },
    ],
    colours: [
      { name: 'Antique Lace',  hex: '#F0EAE0' },
      { name: 'Blush Petal',   hex: '#E8C9B8' },
      { name: 'Warm Sand',     hex: '#D4A882' },
      { name: 'Gold Dust',     hex: '#B89B6A' },
      { name: 'Driftwood',     hex: '#9A8878' },
      { name: 'Deep Taupe',    hex: '#7A6A5A' },
      { name: 'Sage Mist',     hex: '#C8D4C0' },
      { name: 'Fern',          hex: '#8A9A80' },
      { name: 'Forest',        hex: '#5A7050' },
      { name: 'Rose Ash',      hex: '#D4B8C0' },
      { name: 'Mauve',         hex: '#9A7A84' },
      { name: 'Bordeaux',      hex: '#5A3A44' },
      { name: 'Midnight',      hex: '#2A2420' },
    ],
    images: [
      { bg: 'linear-gradient(135deg,#E8DDD0,#C4A882,#9A8878)' },
      { bg: 'linear-gradient(135deg,#E8C9B8,#C9A48A,#A0806A)' },
      { bg: 'linear-gradient(135deg,#C8D4C0,#8A9A80,#5A7050)' },
      { bg: 'linear-gradient(135deg,#D4B8C0,#9A7A84,#5A3A44)' },
    ],
    related: [],
  }
}

export default function ProductPage({ params }) {
  const { slug } = use(params)
  const product = getProduct(slug)

  const [selectedWidth, setSelectedWidth] = useState(product.widths[2]) // default 7mm
  const [selectedColour, setSelectedColour] = useState(product.colours[2])
  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [tab, setTab] = useState('description') // description | care | shipping

  const { addItem } = useCart()

  const skuId = `${product.id}-${selectedWidth.mm}mm-${selectedColour.name.replace(/\s/g,'-').toLowerCase()}`

  const handleAdd = () => {
    addItem({
      skuId,
      productId: product.id,
      name: product.name,
      skuDesc: `${selectedWidth.mm}mm · ${selectedColour.name} · 10m`,
      colour: selectedColour.name,
      colourHex: selectedColour.hex,
      price: selectedWidth.price,
      qty,
      image: null,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <div style={{ padding: '20px 60px', borderBottom: '1px solid var(--sand)' }} className="bc-pad">
        <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)' }}>
          <Link href="/collections" style={{ color: 'inherit' }}>Collections</Link>
          {' / '}
          <Link href={`/collections/${product.collectionSlug}`} style={{ color: 'inherit' }}>{product.collection}</Link>
          {' / '}
          <span style={{ color: 'var(--deep)' }}>{product.name}</span>
        </p>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '80vh' }} className="pp-grid">

        {/* Gallery */}
        <div style={{ background: 'var(--sand)', position: 'relative' }}>
          {/* Main image */}
          <div style={{ aspectRatio: '1', background: product.images[activeImage].bg, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: '55%', opacity: 0.35 }} viewBox="0 0 300 200" fill="none">
                <path d="M 0 100 Q 40 30 80 100 Q 120 170 160 100 Q 200 30 240 100 Q 280 170 300 130"
                  stroke="#9A8878" strokeWidth="3" fill="none"/>
                <path d="M 0 115 Q 40 45 80 115 Q 120 185 160 115 Q 200 45 240 115 Q 280 185 300 145"
                  stroke="#C4A882" strokeWidth="1.5" fill="none" opacity="0.5"/>
              </svg>
            </div>
          </div>
          {/* Thumbnails */}
          <div style={{ display: 'flex', gap: 8, padding: '16px 24px', background: '#fff' }}>
            {product.images.map((img, i) => (
              <button key={i} onClick={() => setActiveImage(i)} style={{
                width: 64, height: 64, border: `2px solid ${activeImage === i ? 'var(--gold)' : 'transparent'}`,
                background: img.bg, padding: 0, cursor: 'pointer', transition: 'border-color 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '60px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}
          className="pp-info-pad">
          <span className="eyebrow" style={{ marginBottom: 16 }}>{product.collection}</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, lineHeight: 1.15, color: 'var(--ink)', marginBottom: 8 }}>
            {product.name}
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: 'var(--taupe)', marginBottom: 28 }}>
            10m spool · 100% pure mulberry silk
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, color: 'var(--ink)', marginBottom: 36 }}>
            {formatGBP(selectedWidth.price)}
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--taupe)', marginLeft: 10, letterSpacing: '0.06em' }}>
              inc. VAT
            </span>
          </p>

          {/* Width selector */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--deep)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>Width</span>
              <em style={{ fontStyle: 'normal', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--taupe)', letterSpacing: 0 }}>
                {selectedWidth.mm}mm selected
              </em>
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {product.widths.map(w => (
                <button key={w.mm} onClick={() => setSelectedWidth(w)} style={{
                  padding: '10px 18px', border: `1px solid ${selectedWidth.mm === w.mm ? 'var(--deep)' : 'var(--warm)'}`,
                  background: selectedWidth.mm === w.mm ? 'var(--deep)' : 'transparent',
                  color: selectedWidth.mm === w.mm ? '#fff' : 'var(--deep)',
                  fontSize: 12, letterSpacing: '0.08em', transition: 'all 0.25s',
                  opacity: w.stock === 0 ? 0.4 : 1,
                }}>
                  {w.mm}mm{w.stock === 0 ? ' — Sold Out' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Colour selector */}
          <div style={{ marginBottom: 36 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--deep)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>Colour</span>
              <em style={{ fontStyle: 'normal', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--taupe)', letterSpacing: 0 }}>
                {selectedColour.name}
              </em>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {product.colours.map(c => (
                <button key={c.name} title={c.name} onClick={() => setSelectedColour(c)} style={{
                  width: 30, height: 30, borderRadius: '50%', background: c.hex,
                  border: '2px solid transparent', cursor: 'pointer',
                  outline: selectedColour.name === c.name ? `2px solid var(--gold)` : 'none',
                  outlineOffset: 3, transition: 'transform 0.2s, outline 0.2s',
                  transform: selectedColour.name === c.name ? 'scale(1.15)' : 'scale(1)',
                }} />
              ))}
            </div>
          </div>

          {/* Quantity + Add */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', border: '1px solid var(--warm)', alignItems: 'center' }}>
              <button onClick={() => setQty(Math.max(1, qty-1))} style={{ width: 44, height: 54, background: 'none', border: 'none', fontSize: 18, color: 'var(--deep)' }}>−</button>
              <span style={{ width: 44, textAlign: 'center', fontSize: 14 }}>{qty}</span>
              <button onClick={() => setQty(qty+1)} style={{ width: 44, height: 54, background: 'none', border: 'none', fontSize: 18, color: 'var(--deep)' }}>+</button>
            </div>
            <button onClick={handleAdd} className="btn-primary" style={{
              flex: 1, background: added ? 'var(--gold)' : undefined,
            }}>
              {added ? '✓ Added to Basket' : 'Add to Basket'}
            </button>
          </div>
          <button className="btn-secondary" style={{ marginBottom: 40 }}>Save to Wishlist</button>

          {/* Features */}
          <div style={{ borderTop: '1px solid var(--sand)', paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { icon: '✦', title: '100% Pure Mulberry Silk', text: 'The finest grade of silk, chosen for incomparable softness and lustre.' },
              { icon: '◎', title: 'Dispatched within 2 business days', text: 'Carefully wound and packaged to preserve every fibre.' },
              { icon: '◇', title: 'Free shipping over £45', text: 'Delivered across the UK and Europe. Tracked & insured.' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14 }}>
                <span style={{ color: 'var(--gold)', fontSize: 14, marginTop: 2, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--deep)', marginBottom: 4 }}>{f.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.7 }}>{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '60px 60px 80px', borderTop: '1px solid var(--sand)' }} className="tabs-pad">
        <div style={{ display: 'flex', gap: 40, borderBottom: '1px solid var(--sand)', marginBottom: 40 }}>
          {[['description','Description'],['care','Care Instructions'],['shipping','Shipping & Returns']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: 'none', border: 'none', paddingBottom: 16,
              fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: tab === id ? 'var(--ink)' : 'var(--taupe)',
              borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.3s, border-color 0.3s',
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 680, fontSize: 14, lineHeight: 2, color: 'var(--taupe)' }}>
          {tab === 'description' && <p style={{ whiteSpace: 'pre-line' }}>{product.description}</p>}
          {tab === 'care' && <p>{product.care}</p>}
          {tab === 'shipping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p><strong style={{ color: 'var(--deep)', fontWeight: 400 }}>UK Standard (Royal Mail):</strong> 3–5 working days · Free over £45, otherwise £3.95</p>
              <p><strong style={{ color: 'var(--deep)', fontWeight: 400 }}>UK Express:</strong> 1–2 working days · £6.95</p>
              <p><strong style={{ color: 'var(--deep)', fontWeight: 400 }}>Europe:</strong> 7–14 working days · £9.95</p>
              <p><strong style={{ color: 'var(--deep)', fontWeight: 400 }}>Returns:</strong> We accept returns within 30 days of delivery. Items must be unused and in original packaging. Please <Link href="/contact" style={{ color: 'var(--gold)' }}>contact us</Link> to arrange a return.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width:900px){ .pp-grid{grid-template-columns:1fr !important} .pp-info-pad{padding:40px 32px !important} .bc-pad,.tabs-pad{padding-left:24px !important;padding-right:24px !important} }
      `}</style>
    </div>
  )
}
