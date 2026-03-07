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

function formatGBP(amount) {
  return '£' + safeNum(amount).toFixed(2)
}

export default function ProductPage({ params }) {
  const [slug, setSlug] = useState('')
  const [product, setProduct] = useState(null)
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [tab, setTab] = useState('description')
  const { addItem } = useCart()

  useEffect(() => {
    const parts = window.location.pathname.split('/')
    const s = parts[parts.length - 1] || ''
    setSlug(s)
  }, [])

  useEffect(() => {
    if (!slug) return
    async function loadProduct() {
      setLoading(true)
      try {
        const { data: prod, error: prodError } = await supabase
          .from('products')
          .select('*')
          .eq('slug', slug)
          .single()

        if (prodError || !prod) { setLoading(false); return }

        const { data: skuData } = await supabase
          .from('product_skus')
          .select('*')
          .eq('product_id', prod.id)
          .order('price_gbp', { ascending: true })

        setProduct(prod)
        const skuList = skuData || []
        setSkus(skuList)
        if (skuList.length > 0) setSelectedSku(skuList[0])
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    loadProduct()
  }, [slug])

  if (loading) {
    return (
      <div style={{ paddingTop: 160, textAlign: 'center', minHeight: '70vh', background: 'var(--cream)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--taupe)' }}>
          Loading artisan details…
        </p>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ paddingTop: 160, textAlign: 'center', minHeight: '70vh', background: 'var(--cream)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--taupe)', marginBottom: 32 }}>
          Product not found
        </p>
        <Link href="/collections">
          <button className="btn-primary" style={{ width: 'auto', padding: '16px 48px' }}>
            Return to Collections
          </button>
        </Link>
      </div>
    )
  }

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

  // Unique colours
  const seen = new Set()
  const uniqueColours = []
  for (const s of skus) {
    const col = safe(s.colour)
    if (!seen.has(col)) { seen.add(col); uniqueColours.push(s) }
  }

  const images = Array.isArray(product.images) ? product.images : []
  const collectionSlug = safe(product.collection)
  const collectionName = collectionSlug.replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const inStock = selectedSku ? (safeNum(selectedSku.stock_qty) > 0) : false

  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <div style={{ padding: '20px 60px', borderBottom: '1px solid var(--sand)' }} className="bc-pad">
        <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)' }}>
          <Link href="/collections" style={{ color: 'inherit' }}>Collections</Link>
          {' / '}
          <Link href={`/collections/${collectionSlug}`} style={{ color: 'inherit' }}>{collectionName}</Link>
          {' / '}
          <span style={{ color: 'var(--deep)' }}>{safe(product.name)}</span>
        </p>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '80vh' }} className="pp-grid">

        {/* Images */}
        <div style={{ background: 'var(--sand)', position: 'relative' }}>
          <div style={{ aspectRatio: '1', position: 'relative', overflow: 'hidden' }}>
            {images.length > 0 ? (
              <img src={images[activeImage]} alt={safe(product.name)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#E8DDD0,#C4A882)' }} />
            )}
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, padding: '16px 24px', background: '#fff', overflowX: 'auto' }}>
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} style={{
                  width: 64, height: 64, flexShrink: 0, padding: 0, cursor: 'pointer',
                  border: `2px solid ${activeImage === i ? 'var(--gold)' : 'transparent'}`,
                }}>
                  <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '60px 70px' }} className="pp-info-pad">
          <span className="eyebrow">{collectionName}</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, marginTop: 16 }}>
            {safe(product.name)}
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, margin: '24px 0' }}>
            {price > 0 ? formatGBP(price) : '—'}
          </p>

          {/* Colour swatches */}
          {uniqueColours.length > 1 && (
            <div style={{ marginBottom: 36 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 12 }}>
                Colour: {selectedSku ? safe(selectedSku.colour) : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {uniqueColours.map(c => (
                  <button key={safe(c.id)} onClick={() => setSelectedSku(skus.find(s => safe(s.colour) === safe(c.colour)))}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: safe(c.colour_hex) || '#ccc',
                      border: '2px solid transparent', cursor: 'pointer',
                      outline: selectedSku && safe(selectedSku.colour) === safe(c.colour) ? '2px solid var(--gold)' : 'none',
                      outlineOffset: 3,
                    }} />
                ))}
              </div>
            </div>
          )}

          {/* Width selector (for fine silk ribbons) */}
          {skus.some(s => s.width_mm) && (
            <div style={{ marginBottom: 36 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 12 }}>
                Width: {selectedSku ? `${safe(selectedSku.width_mm)}mm` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {skus.filter((s, i, arr) => arr.findIndex(x => x.width_mm === s.width_mm) === i).map(s => (
                  <button key={safe(s.id)} onClick={() => setSelectedSku(s)}
                    style={{
                      padding: '6px 16px', border: '1px solid var(--warm)',
                      background: selectedSku && safe(selectedSku.id) === safe(s.id) ? 'var(--ink)' : 'transparent',
                      color: selectedSku && safe(selectedSku.id) === safe(s.id) ? '#fff' : 'var(--ink)',
                      fontSize: 12, cursor: 'pointer',
                    }}>
                    {safe(s.width_mm)}mm
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + Add */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', border: '1px solid var(--warm)', alignItems: 'center' }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))}
                style={{ width: 44, height: 54, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>−</button>
              <span style={{ width: 44, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(qty + 1)}
                style={{ width: 44, height: 54, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>+</button>
            </div>
            <button onClick={handleAdd} className="btn-primary"
              disabled={!selectedSku || !inStock}
              style={{ flex: 1, background: added ? 'var(--gold)' : undefined }}>
              {added ? '✓ Added' : (inStock ? 'Add to Basket' : 'Sold Out')}
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--taupe)', lineHeight: 1.8 }}>
            Free UK shipping on orders over £45 · Dispatched within 2–3 working days
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '60px 60px 80px', borderTop: '1px solid var(--sand)' }}>
        <div style={{ display: 'flex', gap: 40, borderBottom: '1px solid var(--sand)', marginBottom: 40 }}>
          {[['description', 'Description'], ['care', 'Care'], ['shipping', 'Shipping']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: 'none', border: 'none', paddingBottom: 16,
              fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
              color: tab === id ? 'var(--ink)' : 'var(--taupe)',
              borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ maxWidth: 680, fontSize: 14, lineHeight: 2, color: 'var(--taupe)' }}>
          {tab === 'description' && (
            <div dangerouslySetInnerHTML={{ __html: safe(product.description).replace(/\n/g, '<br/>') }} />
          )}
          {tab === 'care' && <p>Hand wash gently in cool water with a mild detergent. Do not wring. Lay flat to dry away from direct sunlight. Iron on a low silk setting with a pressing cloth.</p>}
          {tab === 'shipping' && <p>UK Standard: 3–5 working days · Free on orders over £45<br/>Europe: 7–10 working days · £8.95<br/>All orders are carefully packaged and dispatched within 2–3 working days.</p>}
        </div>
      </div>

      <style>{`
        @media(max-width:900px){
          .pp-grid{grid-template-columns:1fr !important}
          .pp-info-pad{padding:40px 24px !important}
          .bc-pad{padding-left:24px !important;padding-right:24px !important}
        }
      `}</style>
    </div>
  )
}
