'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatGBP } from '@/lib/pricing'
import { useCart } from '@/lib/cart'

export default function ProductPage({ params }) {
  const { slug } = use(params)
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
    async function loadProduct() {
      setLoading(true)
      const { data: prod, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single()

      if (prodError || !prod) {
        console.error(prodError)
        setLoading(false)
        return
      }

      const { data: skuData, error: skuError } = await supabase
        .from('product_skus')
        .select('*')
        .eq('product_id', prod.id)
        .order('price_gbp', { ascending: true })

      setProduct(prod)
      setSkus(skuData || [])
      if (skuData && skuData.length > 0) {
        setSelectedSku(skuData[0])
      }
      setLoading(false)
    }
    loadProduct()
  }, [slug])

  if (loading) {
    return (
      <div style={{ paddingTop: 160, textAlign: 'center', minHeight: '70vh', background: 'var(--cream)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--taupe)' }}>Loading artisan details…</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ paddingTop: 160, textAlign: 'center', minHeight: '70vh', background: 'var(--cream)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', color: 'var(--taupe)', marginBottom: 32 }}>Product not found</p>
        <Link href="/collections"><button className="btn-primary" style={{ width: 'auto', padding: '16px 48px' }}>Return to Collections</button></Link>
      </div>
    )
  }

  const handleAdd = () => {
    if (!selectedSku) return
    addItem({
      skuId: selectedSku.id,
      productId: product.id,
      name: product.name,
      skuDesc: `${selectedSku.colour}${selectedSku.width_mm ? ` · ${selectedSku.width_mm}mm` : ''}`,
      colour: selectedSku.colour,
      colourHex: selectedSku.colour_hex,
      price: selectedSku.price_gbp,
      qty,
      image: product.images?.[0] || null,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  const uniqueColours = Array.from(new Set(skus.map(s => s.colour))).map(name => skus.find(s => s.colour === name))

  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>
      <div style={{ padding: '20px 60px', borderBottom: '1px solid var(--sand)' }} className="bc-pad">
        <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--taupe)' }}>
          <Link href="/collections" style={{ color: 'inherit' }}>Collections</Link> / <Link href={`/collections/${product.collection}`} style={{ color: 'inherit' }}>{product.collection.replace(/-/g, ' ')}</Link> / <span style={{ color: 'var(--deep)' }}>{product.name}</span>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '80vh' }} className="pp-grid">
        <div style={{ background: 'var(--sand)', position: 'relative' }}>
          <div style={{ aspectRatio: '1', position: 'relative', overflow: 'hidden' }}>
            {product.images && product.images.length > 0 ? (
              <img src={product.images[activeImage]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#E8DDD0,#C4A882)' }}>No Image</div>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, padding: '16px 24px', background: '#fff', overflowX: 'auto' }}>
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} style={{ width: 64, height: 64, flexShrink: 0, border: `2px solid ${activeImage === i ? 'var(--gold)' : 'transparent'}`, padding: 0, cursor: 'pointer' }}>
                  <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '60px 70px' }} className="pp-info-pad">
          <span className="eyebrow">{product.collection.replace(/-/g, ' ')}</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, marginTop: 16 }}>{product.name}</h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, margin: '24px 0' }}>{selectedSku ? formatGBP(selectedSku.price_gbp) : '—'}</p>

          {uniqueColours.length > 1 && (
            <div style={{ marginBottom: 36 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 12 }}>Colour: {selectedSku?.colour}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {uniqueColours.map(c => (
                  <button key={c.id} onClick={() => setSelectedSku(skus.find(s => s.colour === c.colour))} style={{ width: 30, height: 30, borderRadius: '50%', background: c.colour_hex, border: '2px solid transparent', outline: selectedSku?.colour === c.colour ? `2px solid var(--gold)` : 'none', outlineOffset: 3 }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', border: '1px solid var(--warm)', alignItems: 'center' }}>
              <button onClick={() => setQty(Math.max(1, qty-1))} style={{ width: 44, height: 54, background: 'none', border: 'none' }}>−</button>
              <span style={{ width: 44, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(qty+1)} style={{ width: 44, height: 54, background: 'none', border: 'none' }}>+</button>
            </div>
            <button onClick={handleAdd} className="btn-primary" disabled={!selectedSku || selectedSku.stock_qty <= 0} style={{ flex: 1, background: added ? 'var(--gold)' : undefined }}>
              {added ? '✓ Added' : (selectedSku?.stock_qty > 0 ? 'Add to Basket' : 'Sold Out')}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '60px 60px 80px', borderTop: '1px solid var(--sand)' }}>
        <div style={{ display: 'flex', gap: 40, borderBottom: '1px solid var(--sand)', marginBottom: 40 }}>
          {[['description','Description'],['care','Care'],['shipping','Shipping']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', paddingBottom: 16, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: tab === id ? 'var(--ink)' : 'var(--taupe)', borderBottom: tab === id ? '2px solid var(--gold)' : '2px solid transparent' }}>{label}</button>
          ))}
        </div>
        <div style={{ maxWidth: 680, fontSize: 14, lineHeight: 2, color: 'var(--taupe)' }}>
          {tab === 'description' && <div dangerouslySetInnerHTML={{ __html: product.description }} />}
          {tab === 'care' && <p>Hand wash gently in cool water. Lay flat to dry.</p>}
          {tab === 'shipping' && <p>UK Standard: 3–5 working days. Free over £45.</p>}
        </div>
      </div>
    </div>
  )
}
