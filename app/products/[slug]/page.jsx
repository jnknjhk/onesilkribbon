'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'

function safe(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
function safeNum(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}
function fmt(amount) {
  return '£' + safeNum(amount).toFixed(2)
}

export default function ProductPage({ params }) {
  const [slug, setSlug] = useState('')
  const [product, setProduct] = useState(null)
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [tab, setTab] = useState('description')
  const [zoomed, setZoomed] = useState(false)
  const { addItem } = useCart()

  useEffect(() => {
    const parts = window.location.pathname.split('/')
    setSlug(parts[parts.length - 1] || '')
  }, [])

  useEffect(() => {
    if (!slug) return
    async function load() {
      setLoading(true)
      try {
        const { data: prod } = await supabase.from('products').select('*').eq('slug', slug).single()
        if (!prod) { setLoading(false); return }
        const { data: skuData } = await supabase.from('product_skus').select('*').eq('product_id', prod.id).order('price_gbp', { ascending: true })
        setProduct(prod)
        const list = skuData || []
        setSkus(list)
        if (list.length > 0) setSelectedSku(list[0])
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: 'var(--taupe)', letterSpacing: '0.05em' }}>
        Loading…
      </p>
    </div>
  )

  if (!product) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>Product not found</p>
      <Link href="/collections"><button className="btn-primary" style={{ width: 'auto', padding: '14px 48px' }}>Back to Collections</button></Link>
    </div>
  )

  const handleAdd = () => {
    if (!selectedSku) return
    addItem({
      skuId: safe(selectedSku.id),
      productId: safe(product.id),
      name: safe(product.name),
      skuDesc: safe(selectedSku.colour) + (selectedSku.width_mm ? ` · ${safe(selectedSku.width_mm)}mm` : ''),
      colour: safe(selectedSku.colour),
      colourHex: safe(selectedSku.colour_hex),
      price: safeNum(selectedSku.price_gbp),
      qty,
      image: Array.isArray(product.images) ? (product.images[0] || null) : null,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  const images = Array.isArray(product.images) ? product.images : []
  const collectionSlug = safe(product.collection)
  const collectionName = collectionSlug.replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const inStock = selectedSku ? safeNum(selectedSku.stock_qty) > 0 : false

  // Unique colours
  const seen = new Set()
  const uniqueColours = []
  for (const s of skus) {
    const c = safe(s.colour)
    if (!seen.has(c)) { seen.add(c); uniqueColours.push(s) }
  }

  // Unique widths
  const seenW = new Set()
  const uniqueWidths = []
  for (const s of skus) {
    if (s.width_mm && !seenW.has(s.width_mm)) { seenW.add(s.width_mm); uniqueWidths.push(s) }
  }

  const hasColours = uniqueColours.length > 1
  const hasWidths = uniqueWidths.length > 1

  return (
    <>
      <div style={{ paddingTop: 80, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Slim breadcrumb */}
        <div style={{ padding: '16px 48px', borderBottom: '1px solid var(--sand)' }} className="bc-pad">
          <p style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--taupe)', margin: 0 }}>
            <Link href="/collections" style={{ color: 'inherit', textDecoration: 'none' }}>Collections</Link>
            <span style={{ margin: '0 10px', opacity: 0.4 }}>·</span>
            <Link href={`/collections/${collectionSlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{collectionName}</Link>
            <span style={{ margin: '0 10px', opacity: 0.4 }}>·</span>
            <span style={{ color: 'var(--ink)' }}>{safe(product.name)}</span>
          </p>
        </div>

        {/* MAIN LAYOUT — full viewport split */}
        <div className="pp-layout" style={{ display: 'grid', gridTemplateColumns: '58% 42%', minHeight: 'calc(100vh - 113px)' }}>

          {/* LEFT — image gallery */}
          <div style={{ position: 'sticky', top: 80, alignSelf: 'start', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }} className="pp-gallery">
            {/* Main image */}
            <div
              onClick={() => setZoomed(true)}
              style={{
                flex: 1, overflow: 'hidden', position: 'relative', cursor: 'zoom-in',
                background: 'var(--sand)',
              }}
            >
              {images.length > 0 ? (
                <img
                  src={images[activeImg]}
                  alt={safe(product.name)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s ease', display: 'block' }}
                  className="pp-main-img"
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #E8DDD0 0%, #C4A882 100%)' }} />
              )}

              {/* Subtle zoom hint */}
              <div style={{
                position: 'absolute', bottom: 20, right: 20,
                background: 'rgba(247,243,238,0.85)', backdropFilter: 'blur(8px)',
                padding: '6px 14px', fontSize: 9, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: 'var(--taupe)',
              }}>
                Click to zoom
              </div>
            </div>

            {/* Thumbnails strip */}
            {images.length > 1 && (
              <div style={{
                display: 'flex', gap: 0, height: 100, flexShrink: 0,
                borderTop: '1px solid var(--sand)', overflowX: 'auto',
              }}>
                {images.slice(0, 8).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    style={{
                      flex: '0 0 100px', height: '100%', border: 'none', padding: 0,
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      borderRight: '1px solid var(--sand)',
                      outline: activeImg === i ? '2px solid var(--gold)' : 'none',
                      outlineOffset: -2,
                    }}
                  >
                    <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: activeImg === i ? 1 : 0.55, transition: 'opacity 0.3s' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — product info */}
          <div style={{ borderLeft: '1px solid var(--sand)', padding: '56px 52px 80px', overflowY: 'auto' }} className="pp-info">

            {/* Collection tag */}
            <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20 }}>
              {collectionName}
            </p>

            {/* Product name */}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 2.8vw, 40px)',
              fontWeight: 300, lineHeight: 1.2, color: 'var(--ink)', marginBottom: 28,
              letterSpacing: '-0.01em',
            }}>
              {safe(product.name)}
            </h1>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid var(--sand)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 300, color: 'var(--ink)' }}>
                {price > 0 ? fmt(price) : '—'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--taupe)', letterSpacing: '0.05em' }}>inc. VAT</span>
            </div>

            {/* Width selector */}
            {hasWidths && (
              <div style={{ marginBottom: 36 }}>
                <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 16 }}>
                  Width — <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{selectedSku ? `${safe(selectedSku.width_mm)}mm` : ''}</span>
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {uniqueWidths.map(s => {
                    const active = selectedSku && safe(selectedSku.width_mm) === safe(s.width_mm)
                    return (
                      <button key={safe(s.id)} onClick={() => setSelectedSku(s)} style={{
                        padding: '8px 20px',
                        border: `1px solid ${active ? 'var(--ink)' : 'var(--warm)'}`,
                        background: active ? 'var(--ink)' : 'transparent',
                        color: active ? '#fff' : 'var(--ink)',
                        fontSize: 12, letterSpacing: '0.08em', cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}>
                        {safe(s.width_mm)}mm
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Colour selector */}
            {hasColours && (
              <div style={{ marginBottom: 36 }}>
                <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 16 }}>
                  Colour — <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{selectedSku ? safe(selectedSku.colour) : ''}</span>
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {uniqueColours.map(c => {
                    const active = selectedSku && safe(selectedSku.colour) === safe(c.colour)
                    const hex = safe(c.colour_hex) || '#D4C5B0'
                    return (
                      <button
                        key={safe(c.id)}
                        title={safe(c.colour)}
                        onClick={() => setSelectedSku(skus.find(s => safe(s.colour) === safe(c.colour)))}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: hex, border: 'none',
                          cursor: 'pointer', position: 'relative',
                          boxShadow: active ? `0 0 0 2px var(--cream), 0 0 0 4px var(--gold)` : `0 0 0 1px rgba(0,0,0,0.12)`,
                          transition: 'box-shadow 0.2s',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Qty + Add to basket */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, height: 54 }}>
              {/* Qty */}
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--warm)', borderRight: 'none' }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={{
                  width: 44, height: '100%', background: 'none', border: 'none',
                  fontSize: 18, color: 'var(--ink)', cursor: 'pointer',
                }}>−</button>
                <span style={{ width: 36, textAlign: 'center', fontSize: 14, color: 'var(--ink)' }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} style={{
                  width: 44, height: '100%', background: 'none', border: 'none',
                  fontSize: 18, color: 'var(--ink)', cursor: 'pointer',
                }}>+</button>
              </div>

              {/* Add button */}
              <button
                onClick={handleAdd}
                disabled={!selectedSku || !inStock}
                style={{
                  flex: 1, height: '100%', border: 'none',
                  background: added ? 'var(--gold)' : 'var(--ink)',
                  color: '#fff', fontSize: 11, letterSpacing: '0.25em',
                  textTransform: 'uppercase', cursor: selectedSku && inStock ? 'pointer' : 'not-allowed',
                  transition: 'background 0.3s',
                  opacity: !selectedSku || !inStock ? 0.5 : 1,
                }}
              >
                {added ? '✓  Added to Basket' : (!inStock ? 'Sold Out' : 'Add to Basket')}
              </button>
            </div>

            {/* Free shipping nudge */}
            <p style={{ fontSize: 11, color: 'var(--taupe)', letterSpacing: '0.04em', marginBottom: 48, lineHeight: 1.7 }}>
              Free UK shipping on orders over £45 · Dispatched within 2–3 working days
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--sand)', marginBottom: 40 }} />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 32, marginBottom: 32, borderBottom: '1px solid var(--sand)' }}>
              {[['description', 'Description'], ['care', 'Care & Handling'], ['shipping', 'Delivery']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  background: 'none', border: 'none', paddingBottom: 14,
                  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: tab === id ? 'var(--ink)' : 'var(--taupe)',
                  borderBottom: tab === id ? '1px solid var(--ink)' : '1px solid transparent',
                  marginBottom: -1, cursor: 'pointer', transition: 'color 0.2s',
                }}>{label}</button>
              ))}
            </div>

            <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--taupe)', maxWidth: 480 }}>
              {tab === 'description' && (
                safe(product.description)
                  ? <div dangerouslySetInnerHTML={{ __html: safe(product.description).replace(/\n/g, '<br/>').replace(/✦/g, '<span style="color:var(--gold)">✦</span>') }} />
                  : <p style={{ fontStyle: 'italic' }}>No description available.</p>
              )}
              {tab === 'care' && (
                <div>
                  <p>Our silk ribbons are delicate and should be treated with care.</p>
                  <br/>
                  <p>· Hand wash gently in cool water with a mild detergent</p>
                  <p>· Do not wring or tumble dry</p>
                  <p>· Lay flat to dry, away from direct sunlight</p>
                  <p>· Iron on a low silk setting using a pressing cloth</p>
                  <p>· Store rolled or flat, away from moisture and heat</p>
                </div>
              )}
              {tab === 'shipping' && (
                <div>
                  <p>· <strong style={{color:'var(--ink)', fontWeight:400}}>UK Standard</strong> — 3–5 working days, free over £45</p>
                  <p>· <strong style={{color:'var(--ink)', fontWeight:400}}>UK Express</strong> — 1–2 working days, £5.95</p>
                  <p>· <strong style={{color:'var(--ink)', fontWeight:400}}>Europe</strong> — 7–10 working days, £8.95</p>
                  <p>· <strong style={{color:'var(--ink)', fontWeight:400}}>Rest of World</strong> — 10–14 working days, £12.95</p>
                  <br/>
                  <p>All orders are carefully wrapped and dispatched within 2–3 working days.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Lightbox zoom */}
      {zoomed && images.length > 0 && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(28,23,20,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={images[activeImg]}
            alt={safe(product.name)}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <button onClick={() => setZoomed(false)} style={{
            position: 'absolute', top: 28, right: 28,
            background: 'none', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', width: 44, height: 44, borderRadius: '50%',
            fontSize: 18, cursor: 'pointer',
          }}>✕</button>
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setActiveImg(i => (i - 1 + images.length) % images.length) }} style={{
                position: 'absolute', left: 28, background: 'none', border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', width: 44, height: 44, borderRadius: '50%', fontSize: 18, cursor: 'pointer',
              }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setActiveImg(i => (i + 1) % images.length) }} style={{
                position: 'absolute', right: 84, background: 'none', border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', width: 44, height: 44, borderRadius: '50%', fontSize: 18, cursor: 'pointer',
              }}>›</button>
            </>
          )}
        </div>
      )}

      <style>{`
        .pp-main-img:hover { transform: scale(1.03); }
        @media(max-width: 960px) {
          .pp-layout { grid-template-columns: 1fr !important; }
          .pp-gallery { position: relative !important; top: 0 !important; height: auto !important; }
          .pp-info { border-left: none !important; border-top: 1px solid var(--sand); padding: 40px 24px 60px !important; }
          .bc-pad { padding-left: 24px !important; padding-right: 24px !important; }
        }
      `}</style>
    </>
  )
}
