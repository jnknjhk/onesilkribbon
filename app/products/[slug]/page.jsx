'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'

function safe(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
function safeNum(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n }
function fmt(amount) { return '£' + safeNum(amount).toFixed(2) }

export default function ProductPage({ params }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [product, setProduct] = useState(null)
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [buyingNow, setBuyingNow] = useState(false)
  const [tab, setTab] = useState('description')
  const [selectedAttrs, setSelectedAttrs] = useState({})
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
        if (list.length > 0) {
          const firstAttrs = list[0].attributes || {}
          setSelectedAttrs(firstAttrs)
          setSelectedSku(list[0])
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (skus.length === 0) return
    const match = skus.find(s => {
      const attrs = s.attributes || {}
      return Object.keys(selectedAttrs).every(k => attrs[k] === selectedAttrs[k])
    })
    if (match) setSelectedSku(match)
  }, [selectedAttrs, skus])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: 'var(--taupe)' }}>Loading…</p>
    </div>
  )

  if (!product) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>Product not found</p>
      <Link href="/collections"><button className="btn-primary" style={{ width: 'auto', padding: '14px 48px' }}>Back to Collections</button></Link>
    </div>
  )

  const productImages = Array.isArray(product.images) ? product.images : []
  const skuImages = selectedSku && Array.isArray(selectedSku.images) && selectedSku.images.length > 0 ? selectedSku.images : null
  const images = skuImages || productImages
  const collectionSlug = safe(product.collection)
  const collectionName = collectionSlug.replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const inStock = selectedSku ? safeNum(selectedSku.stock_qty) > 0 : false

  const attrConfig = product.attribute_config || []
  let attributeOptions = []

  if (attrConfig.length > 0) {
    attributeOptions = attrConfig.map(a => ({ name: a.name, options: a.options || [] }))
  } else {
    const colours = [...new Set(skus.map(s => safe(s.colour)).filter(Boolean))]
    const widths = [...new Set(skus.map(s => s.width_mm).filter(Boolean))]
    if (colours.length > 1) attributeOptions.push({ name: 'Colour', options: colours })
    if (widths.length > 1) attributeOptions.push({ name: 'Width', options: widths.map(w => `${w}mm`) })
    if (Object.keys(selectedAttrs).length === 0 && skus.length > 0) {
      const init = {}
      if (colours.length > 1) init['Colour'] = colours[0]
      if (widths.length > 1) init['Width'] = `${widths[0]}mm`
      if (Object.keys(init).length > 0) setSelectedAttrs(init)
    }
  }

  const handleAttrChange = (attrName, value) => {
    setSelectedAttrs(prev => ({ ...prev, [attrName]: value }))
    setImgIdx(0)
  }

  const buildCartItem = () => {
    if (!selectedSku) return null
    const attrDesc = Object.values(selectedAttrs).filter(Boolean).join(' · ')
    return {
      skuId: safe(selectedSku.id),
      productId: safe(product.id),
      name: safe(product.name),
      skuDesc: attrDesc || safe(selectedSku.colour),
      colour: safe(selectedSku.colour),
      colourHex: safe(selectedSku.colour_hex),
      price: safeNum(selectedSku.price_gbp),
      qty,
      image: images[0] || null,
    }
  }

  const handleAdd = () => {
    const item = buildCartItem()
    if (!item) return
    addItem(item)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  // Buy Now — 加入购物车后直接跳转结账
  const handleBuyNow = () => {
    const item = buildCartItem()
    if (!item) return
    setBuyingNow(true)
    addItem(item)
    // 短暂延迟确保 cart state 更新后再跳转
    setTimeout(() => {
      router.push('/checkout')
    }, 100)
  }

  const navImg = (d) => setImgIdx(i => (i + d + images.length) % images.length)

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Breadcrumb */}
        <div style={{ padding: '16px 60px', borderBottom: '1px solid var(--sand)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--taupe)' }} className="bc-pad">
          <Link href="/collections" style={{ color: 'inherit', textDecoration: 'none' }}>Collections</Link>
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          <Link href={`/collections/${collectionSlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{collectionName}</Link>
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          <span style={{ color: 'var(--ink)' }}>{safe(product.name)}</span>
        </div>

        {/* ═══ ZONE 1: IMAGE + ATTRIBUTES ═══ */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          maxWidth: 1360, margin: '0 auto',
          padding: '48px 60px', gap: 64, alignItems: 'start',
        }} className="zone1">

          {/* LEFT: gallery */}
          <div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', background: 'var(--sand)', cursor: 'zoom-in' }} className="main-wrap">
              {images.length > 0 ? (
                <img src={images[imgIdx]} alt={safe(product.name)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .8s cubic-bezier(.25,.46,.45,.94)' }}
                  className="main-img-hover" />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg,#E8DDD0,#C4A882)' }} />
              )}
              {images.length > 1 && <>
                <button onClick={() => navImg(-1)} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, background: 'rgba(247,243,238,0.88)', backdropFilter: 'blur(6px)', border: 'none', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>‹</button>
                <button onClick={() => navImg(1)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, background: 'rgba(247,243,238,0.88)', backdropFilter: 'blur(6px)', border: 'none', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>›</button>
              </>}
              {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(247,243,238,0.88)', backdropFilter: 'blur(6px)', padding: '4px 11px', fontSize: 9, letterSpacing: '.14em', color: 'var(--taupe)' }}>
                  {imgIdx + 1} / {images.length}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {images.slice(0, 8).map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} style={{
                    width: 60, height: 60, flexShrink: 0, padding: 0, border: 'none',
                    cursor: 'pointer', overflow: 'hidden', position: 'relative',
                    opacity: imgIdx === i ? 1 : 0.38, transition: 'opacity .3s',
                    outline: imgIdx === i ? '2px solid var(--gold)' : 'none', outlineOffset: -2,
                  }}>
                    <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: attributes */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>{collectionName}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 300, lineHeight: 1.12, color: 'var(--ink)', marginBottom: 28 }}>{safe(product.name)}</h1>

            {/* Price — 改为含税说明 + 运费提示 */}
            <div style={{ padding: '20px 0', borderTop: '1px solid var(--sand)', borderBottom: '1px solid var(--sand)', marginBottom: 30 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, color: 'var(--ink)', lineHeight: 1 }}>
                {price > 0 ? fmt(price) : '—'}
              </div>
              <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.06em', marginTop: 6, lineHeight: 1.6 }}>
                Tax included. Shipping calculated at checkout.
              </p>
            </div>

            {/* 属性下拉框 */}
            {attributeOptions.map(attr => (
              <div key={attr.name} style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 10 }}>
                  {attr.name}
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedAttrs[attr.name] || ''}
                    onChange={e => handleAttrChange(attr.name, e.target.value)}
                    style={{
                      width: '100%', padding: '14px 40px 14px 16px',
                      border: '1px solid var(--warm)', background: 'var(--cream)',
                      fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)',
                      outline: 'none', cursor: 'pointer', appearance: 'none',
                      WebkitAppearance: 'none', borderRadius: 0,
                    }}
                  >
                    {attr.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--taupe)', fontSize: 10 }}>▼</div>
                </div>
              </div>
            ))}

            {/* 库存提示 */}
            {selectedSku && safeNum(selectedSku.stock_qty) > 0 && safeNum(selectedSku.stock_qty) <= 5 && (
              <p style={{ fontSize: 11, color: '#C0392B', marginBottom: 16, letterSpacing: '.03em' }}>
                Only {selectedSku.stock_qty} left in stock
              </p>
            )}

            {/* Qty + Add to Basket */}
            <div style={{ display: 'flex', height: 50 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--warm)', borderRight: 'none' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 44, height: '100%', background: 'none', border: 'none', fontSize: 18, color: 'var(--ink)', cursor: 'pointer' }}>−</button>
                <span style={{ width: 32, textAlign: 'center', fontSize: 13 }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ width: 44, height: '100%', background: 'none', border: 'none', fontSize: 18, color: 'var(--ink)', cursor: 'pointer' }}>+</button>
              </div>
              <button onClick={handleAdd} disabled={!selectedSku || !inStock} style={{
                flex: 1, background: added ? 'var(--gold)' : 'var(--ink)', color: '#fff', border: 'none',
                fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
                cursor: selectedSku && inStock ? 'pointer' : 'not-allowed',
                opacity: !selectedSku || !inStock ? 0.5 : 1, transition: 'background .28s',
              }}>
                {added ? '✓  Added to Basket' : !inStock ? 'Sold Out' : 'Add to Basket'}
              </button>
            </div>

            {/* Buy Now 按钮 */}
            <button onClick={handleBuyNow} disabled={!selectedSku || !inStock || buyingNow} style={{
              width: '100%', height: 50, marginTop: 10,
              background: 'var(--gold)', color: '#fff', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
              cursor: selectedSku && inStock && !buyingNow ? 'pointer' : 'not-allowed',
              opacity: !selectedSku || !inStock ? 0.5 : 1, transition: 'background .28s',
            }}>
              {buyingNow ? 'Redirecting…' : 'Buy Now'}
            </button>
          </div>
        </div>

        {/* ═══ ZONE 2: PRODUCT DETAIL ═══ */}
        <div style={{ borderTop: '1px solid var(--sand)', padding: '80px 60px 100px' }} className="zone2-pad">
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--sand)', marginBottom: 56 }}>
              {[['description', 'Description'], ['care', 'Care'], ['shipping', 'Delivery']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  background: 'none', border: 'none', padding: '18px 0', margin: '0 24px',
                  fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase',
                  color: tab === id ? 'var(--ink)' : 'var(--taupe)', cursor: 'pointer',
                  borderBottom: tab === id ? '1px solid var(--gold)' : '1px solid transparent',
                  marginBottom: -1, transition: 'color .2s',
                }}>{label}</button>
              ))}
            </div>

            {tab === 'description' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start' }} className="desc-grid">
                <div style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)' }}>
                  {safe(product.description) ? (
                    <div dangerouslySetInnerHTML={{ __html: safe(product.description).replace(/\n/g, '<br/>').replace(/✦/g, '<span style="color:var(--gold)">✦</span>') }} />
                  ) : (
                    <p><span style={{ color: 'var(--gold)' }}>✦</span>{' '}A beautiful silk ribbon, handcrafted with care.</p>
                  )}
                </div>
                <div>
                  {(Array.isArray(product.specifications)
                    ? product.specifications.filter(s => s.key?.trim() && s.value?.toString().trim())
                    : []
                  ).map((spec, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '13px 0', borderBottom: '1px solid var(--sand)', fontSize: 12 }}>
                      <span style={{ fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--taupe)' }}>{spec.key}</span>
                      <span style={{ color: 'var(--ink)', textAlign: 'right', maxWidth: 200, lineHeight: 1.6 }}>{spec.value}</span>
                    </div>
                  ))}
                  {(!Array.isArray(product.specifications) || product.specifications.filter(s => s.key?.trim() && s.value?.toString().trim()).length === 0) && (
                    <p style={{ fontSize: 12, color: 'var(--warm)', fontStyle: 'italic' }}>No specifications listed.</p>
                  )}
                </div>
              </div>
            )}

            {tab === 'care' && (
              <div style={{ maxWidth: 560, margin: '0 auto' }}>
                {[
                  { title: 'Washing', items: ['Hand wash gently in cool water with a mild detergent', 'Do not wring — lay flat to dry away from direct sunlight', 'Avoid soaking for extended periods'] },
                  { title: 'Ironing & Storage', items: ['Iron on a low silk setting using a pressing cloth', 'Store rolled or flat, away from moisture and heat', 'Avoid contact with perfume, hairspray, or harsh chemicals'] },
                  { title: 'Handling', items: ['Handle with clean, dry hands to preserve the natural sheen', 'Keep away from sharp objects that may snag the delicate fibres'] },
                ].map(({ title, items }) => (
                  <div key={title}>
                    <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 16, marginTop: 36, paddingBottom: 12, borderBottom: '1px solid var(--sand)' }} className="first-section-title">{title}</p>
                    {items.map((item, i) => <p key={i} style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 2.2, marginBottom: 8 }}>· {item}</p>)}
                  </div>
                ))}
              </div>
            )}

            {tab === 'shipping' && (
              <div style={{ maxWidth: 560, margin: '0 auto' }}>
                {[
                  { title: 'UK Delivery', items: ['Standard — 3–5 working days · Free on orders over £45', 'Express — 1–2 working days · £5.95'] },
                  { title: 'International Delivery', items: ['Europe — 7–10 working days · £8.95', 'Rest of World — 10–14 working days · £12.95'] },
                  { title: 'Packaging & Dispatch', items: ['All orders are carefully wrapped in tissue paper and sealed with our wax stamp. Dispatched within 2–3 working days, Monday to Friday.'] },
                ].map(({ title, items }) => (
                  <div key={title}>
                    <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 16, marginTop: 36, paddingBottom: 12, borderBottom: '1px solid var(--sand)' }}>{title}</p>
                    {items.map((item, i) => <p key={i} style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 2.2, marginBottom: 8 }}>· {item}</p>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Story */}
        <div style={{ borderTop: '1px solid var(--sand)', background: 'var(--sand)' }}>
          <div style={{ padding: '100px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, maxWidth: 1360, margin: '0 auto', alignItems: 'center' }} className="story-grid">
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, lineHeight: 1.2, color: 'var(--ink)', marginBottom: 28 }}>
                The Art of the<br /><em>Hand-Torn Edge</em>
              </h2>
              <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 2.2, marginBottom: 16 }}>
                Each ribbon is carefully hand-torn to create naturally frayed edges that celebrate the beauty of imperfection.
              </p>
              <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 2.2 }}>
                The result is something you feel before you see: a quiet luxury in the hands, a weight that speaks of care, and an edge that tells the story of how it was made.
              </p>
            </div>
            <div style={{ aspectRatio: '1/1', overflow: 'hidden' }}>
              {images.length > 0 && (
                <img src={images[images.length > 1 ? 1 : 0]} alt={safe(product.name)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .main-wrap:hover .main-img-hover { transform: scale(1.04); }
        @media(max-width: 960px) {
          .zone1 { grid-template-columns: 1fr !important; gap: 40px !important; padding: 32px 24px !important; }
          .desc-grid { grid-template-columns: 1fr !important; }
          .story-grid { grid-template-columns: 1fr !important; gap: 48px !important; padding: 60px 24px !important; }
          .bc-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .zone2-pad { padding-left: 24px !important; padding-right: 24px !important; }
        }
        .first-section-title { margin-top: 0 !important; }
      `}</style>
    </>
  )
}
