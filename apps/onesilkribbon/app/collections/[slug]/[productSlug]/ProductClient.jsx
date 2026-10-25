'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { skuAttributes, matchSku } from '@/lib/product-variants'
import { shippingSettingsFromApi } from '@/lib/pricing'

const EMPTY_LIST = []

function safe(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
function safeNum(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n }

// 图片 alt 决定这张图能不能被 Google 图片搜索检索到。丝带是极度视觉化的商品，
// 图片搜索是实打实的流量来源，而缩略图原来写死的 "view 1/2/3" 完全没有信息量。
// 没有逐图的人工描述，就用商品自己的数据拼：商品名 + 所属系列（+ 第几张）。
// 只用库里已有的事实，不替商品编造材质或用途——alt 写错比写少更糟。
function imageAlt(product, i = 0, total = 1) {
  const name = safe(product?.name) || 'One Silk Ribbon product'
  const collection = safe(product?.collection).replace(/-/g, ' ').trim()
  const base = collection ? `${name} — ${collection}` : name
  return total > 1 ? `${base}, photo ${i + 1} of ${total}` : base
}
function fmt(amount) { return '£' + safeNum(amount).toFixed(2) }

export default function ProductClient({ initialProduct, initialSkus, initialSku, slug, related }) {
  const router = useRouter()
  const product = initialProduct || null
  const skus = initialSkus || EMPTY_LIST
  const relatedProducts = related || []
  const [shippingInfo, setShippingInfo] = useState({ rate: '3.95', threshold: '45', freeEnabled: true })
  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [buyingNow, setBuyingNow] = useState(false)
  const [tab, setTab] = useState('description')
  const [selectedAttrs, setSelectedAttrs] = useState(() => skuAttributes(product, initialSku))
  // Derive immediately: an effect leaves a render where the chosen option and
  // the SKU sent to the basket disagree.
  const selectedSku = matchSku(product, skus, selectedAttrs, initialSku)
  const addedTimer = useRef(null)
  const thumbnailStrip = useRef(null)
  useEffect(() => () => clearTimeout(addedTimer.current), [])
  const { addItem } = useCart()

  // Move only the thumbnail strip; scrolling the document here would pull a
  // mobile customer away from the photo or the selected product options.
  useEffect(() => {
    const strip = thumbnailStrip.current
    const selected = strip?.querySelector('[aria-pressed="true"]')
    if (!selected) return
    const left = selected.offsetLeft
    const right = left + selected.offsetWidth
    if (left < strip.scrollLeft) strip.scrollTo({ left, behavior: 'instant' })
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: right - strip.clientWidth, behavior: 'instant' })
  }, [imgIdx, selectedSku, selectedAttrs])

  // 切换到不同商品（slug 变化）时重置选择状态，不重新请求数据——SSR 已经把数据备好了
  useEffect(() => {
    setSelectedAttrs(skuAttributes(product, initialSku))
    setImgIdx(0)
    setQty(1)
    // 从系列页往下滑很多之后点进商品，Next.js 的默认滚动还原有时候不会把新页面滚回顶部
    // （尤其是从系列页跳到商品详情页这种嵌套路由场景），手动强制归零，
    // 用 'instant' 而不是默认的 smooth，避免落地后又能看到一段"慢慢滚上去"的动画
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [slug, product, initialSku])

  // 无 attribute_config 时，按颜色/宽度自动预选默认项（放在 effect 里，避免渲染期间 setState）
  useEffect(() => {
    if (!product) return
    const attrConfig = product.attribute_config || []
    if (attrConfig.length > 0) return
    if (skus.length === 0) return
    if (Object.keys(selectedAttrs).length > 0) return
    const colours = [...new Set(skus.map(s => safe(s.colour)).filter(Boolean))]
    const widths = [...new Set(skus.map(s => s.width_mm).filter(Boolean))]
    const init = {}
    if (colours.length > 1) init['Colour'] = colours[0]
    if (widths.length > 1) init['Width'] = `${widths[0]}mm`
    if (Object.keys(init).length > 0) setSelectedAttrs(init)
  }, [product, skus, selectedAttrs])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/settings', { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Settings unavailable'); return r.json() })
      .then(data => {
        const settings = shippingSettingsFromApi(data)
        if (!controller.signal.aborted) setShippingInfo({
          rate: Number(settings.shippingRate).toFixed(2),
          threshold: String(Number(settings.freeShippingThreshold)),
          freeEnabled: settings.freeShippingEnabled,
        })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  if (!product) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--taupe)' }}>Product not found</p>
      <Link href="/collections"><button className="btn-primary" style={{ width: 'auto', padding: '14px 48px' }}>Back to Collections</button></Link>
    </div>
  )

  const productImages = Array.isArray(product.images) ? product.images : []
  const attrConfig = product.attribute_config || []

  // ── 图片优先级：SKU图片 > 属性选项图片 > 产品主图 ──────────────────────
  // 注意：直接用 selectedAttrs 计算，不依赖异步更新的 selectedSku
  let images = productImages

  // 按顺序找 attribute_config 里当前选中值有图的属性
  let attrImage = null
  for (const attr of attrConfig) {
    const selectedVal = selectedAttrs[attr.name]
    if (!selectedVal) continue
    const opt = (attr.options || []).find(o => {
      const val = typeof o === 'object' ? o.value : o
      return val === selectedVal
    })
    if (opt && typeof opt === 'object' && opt.image && opt.image.trim()) {
      attrImage = opt.image
      break
    }
  }

  if (attrImage) {
    images = [attrImage, ...productImages.filter(img => img !== attrImage)]
  }
  if (Array.isArray(selectedSku?.images) && selectedSku.images.length) images = selectedSku.images
  const collectionSlug = safe(product.collection)
  const collectionName = collectionSlug.replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const minPrice = skus.length > 0 ? Math.min(...skus.map(s => safeNum(s.price_gbp)).filter(p => p > 0)) : 0
  const inStock = selectedSku ? safeNum(selectedSku.stock_qty) > 0 : false
  const hasSelected = !!selectedSku

  let attributeOptions = []

  if (attrConfig.length > 0) {
    attributeOptions = attrConfig.map(a => ({ name: a.name, options: a.options || [] }))
  } else {
    const colours = [...new Set(skus.map(s => safe(s.colour)).filter(Boolean))]
    const widths = [...new Set(skus.map(s => s.width_mm).filter(Boolean))]
    const lengths = [...new Set(skus.map(s => s.length_m).filter(Boolean))]
    if (colours.length > 1) attributeOptions.push({ name: 'Colour', options: colours })
    if (widths.length > 1) attributeOptions.push({ name: 'Width', options: widths.map(w => `${w}mm`) })
    if (lengths.length > 1) attributeOptions.push({ name: 'Length', options: lengths.map(l => `${l}m`) })
  }

  const handleAttrChange = (attrName, value) => {
    setSelectedAttrs(prev => ({ ...prev, [attrName]: value }))
    setImgIdx(0)  // 切换颜色时重置到第一张图
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
    clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(false), 2000)
  }

  // Buy Now — 加入购物车后直接跳转结账
  const handleBuyNow = () => {
    const item = buildCartItem()
    if (!item) return
    setBuyingNow(true)
    addItem(item)
    router.push('/checkout')
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
              {(images.length > 0) ? (
                <NextImage
                  src={images[imgIdx]} alt={imageAlt(product, imgIdx, images.length)} fill
                  sizes="(max-width: 960px) 100vw, 50vw"
                  style={{ objectFit: 'cover', transition: 'transform .8s cubic-bezier(.25,.46,.45,.94)' }}
                  className="main-img-hover"
                  priority={true}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg,#E8DDD0,#C4A882)' }} />
              )}
              {images.length > 1 && <>
                <button aria-label="Previous product photo" onClick={() => navImg(-1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'rgba(247,243,238,0.88)', backdropFilter: 'blur(6px)', border: 'none', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>‹</button>
                <button aria-label="Next product photo" onClick={() => navImg(1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'rgba(247,243,238,0.88)', backdropFilter: 'blur(6px)', border: 'none', color: 'var(--ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>›</button>
              </>}
              {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(247,243,238,0.88)', backdropFilter: 'blur(6px)', padding: '4px 11px', fontSize: 9, letterSpacing: '.14em', color: 'var(--taupe)' }}>
                  {imgIdx + 1} / {images.length}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div ref={thumbnailStrip} className="product-thumbnails" style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {images.map((img, i) => (
                  <button key={i} aria-label={`Show product photo ${i + 1}`} aria-pressed={imgIdx === i} onClick={() => setImgIdx(i)} style={{
                    width: 60, height: 60, flexShrink: 0, padding: 0, border: 'none',
                    cursor: 'pointer', overflow: 'hidden', position: 'relative',
                    opacity: imgIdx === i ? 1 : 0.38, transition: 'opacity .3s',
                    outline: imgIdx === i ? '2px solid var(--gold)' : 'none', outlineOffset: -2,
                  }}>
                    <NextImage src={img} alt={imageAlt(product, i, images.length)} fill sizes="80px" style={{ objectFit: 'cover' }} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: attributes */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>{collectionName}</p>
            <h1 className="product-title" style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 300, lineHeight: 1.12, color: 'var(--ink)', marginBottom: 28 }}>{safe(product.name)}</h1>

            {/* Price — 改为含税说明 + 运费提示 */}
            <div style={{ padding: '20px 0', borderTop: '1px solid var(--sand)', borderBottom: '1px solid var(--sand)', marginBottom: 30 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, color: 'var(--ink)', lineHeight: 1 }}>
                {hasSelected && price > 0 ? fmt(price) : minPrice > 0 ? <span style={{ fontSize: 24 }}>From {fmt(minPrice)}</span> : '—'}
              </div>
              <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.06em', marginTop: 6, lineHeight: 1.6 }}>
                Tax included. Shipping calculated at checkout.
              </p>
            </div>

            {/* 属性下拉框 */}
            {attributeOptions.map((attr, attrIndex) => (
              <div key={attr.name} style={{ marginBottom: 24 }}>
                <label htmlFor={`product-option-${attrIndex}`} style={{ display: 'block', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 10 }}>
                  {attr.name}
                </label>
                <div style={{ position: 'relative' }}>
                  <select id={`product-option-${attrIndex}`}
                    value={selectedAttrs[attr.name] || '__placeholder__'}
                    onChange={e => handleAttrChange(attr.name, e.target.value === '__placeholder__' ? '' : e.target.value)}
                    style={{
                      width: '100%', padding: '14px 40px 14px 16px',
                      border: '1px solid var(--warm)', background: 'var(--cream)',
                      fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)',
                      outline: 'none', cursor: 'pointer', appearance: 'none',
                      WebkitAppearance: 'none', borderRadius: 0,
                    }}
                  >
                    <option value="__placeholder__">Please select</option>
                    {attr.options.map(opt => {
                      const val = typeof opt === 'object' ? opt.value : opt
                      return <option key={val} value={val}>{val}</option>
                    })}
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
            <div className="product-buy-controls" style={{ display: 'flex', height: 50 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--warm)', borderRight: 'none' }}>
                <button aria-label="Decrease quantity" onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 44, height: '100%', background: 'none', border: 'none', fontSize: 18, color: 'var(--ink)', cursor: 'pointer' }}>−</button>
                <span style={{ width: 32, textAlign: 'center', fontSize: 13 }}>{qty}</span>
                <button aria-label="Increase quantity" onClick={() => setQty(q => q + 1)} style={{ width: 44, height: '100%', background: 'none', border: 'none', fontSize: 18, color: 'var(--ink)', cursor: 'pointer' }}>+</button>
              </div>
              <button onClick={handleAdd} disabled={!selectedSku || !inStock} style={{
                flex: 1, background: added ? 'var(--gold)' : 'var(--ink)', color: '#fff', border: 'none',
                fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase',
                cursor: selectedSku && inStock ? 'pointer' : 'not-allowed',
                opacity: !selectedSku || !inStock ? 0.5 : 1, transition: 'background .28s',
              }}>
                {added ? '✓  Added to Basket' : !hasSelected ? 'Please Select Options' : !inStock ? 'Sold Out' : 'Add to Basket'}
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
              {buyingNow ? 'Redirecting…' : !hasSelected ? 'Please Select Options' : 'Buy Now'}
            </button>

            {/* Trust badges */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 24, flexWrap: 'wrap' }}>
              {['🔒 Secure Checkout', '↩ Easy Returns', '📦 Dispatched in 2 Days'].map(t => (
                <span key={t} style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '0.06em' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ ZONE 2: PRODUCT DETAIL ═══ */}
        <div style={{ borderTop: '1px solid var(--sand)', padding: '80px 60px 100px' }} className="zone2-pad">
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="product-detail-tabs" style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--sand)', marginBottom: 56 }}>
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
                <div style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)' }}>
                  {safe(product.description) ? (
                    <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml || '' }} />
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
                    {items.map((item, i) => <p key={i} style={{ fontSize: 15, fontWeight: 400, color: 'var(--taupe)', lineHeight: 2.2, marginBottom: 8 }}>· {item}</p>)}
                  </div>
                ))}
              </div>
            )}

            {tab === 'shipping' && (
              <div style={{ maxWidth: 560, margin: '0 auto' }}>
                {[
                  { title: 'Delivery', items: [shippingInfo.freeEnabled ? `Free on orders over £${shippingInfo.threshold}, otherwise £${shippingInfo.rate} per order` : `£${shippingInfo.rate} per order`, 'Shipped by air, typically arriving within 5–14 days of dispatch'] },
                  { title: 'Packaging & Dispatch', items: ['All orders are carefully wrapped in tissue paper and sealed with our wax stamp. Dispatched within 2 business days of payment being received.'] },
                ].map(({ title, items }) => (
                  <div key={title}>
                    <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 16, marginTop: 36, paddingBottom: 12, borderBottom: '1px solid var(--sand)' }}>{title}</p>
                    {items.map((item, i) => <p key={i} style={{ fontSize: 15, fontWeight: 400, color: 'var(--taupe)', lineHeight: 2.2, marginBottom: 8 }}>· {item}</p>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Story */}
        {collectionSlug === 'hand-frayed-silk-ribbons' && <div style={{ borderTop: '1px solid var(--sand)', background: 'var(--sand)' }}>
          <div style={{ padding: '100px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, maxWidth: 1360, margin: '0 auto', alignItems: 'center' }} className="story-grid">
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, lineHeight: 1.2, color: 'var(--ink)', marginBottom: 28 }}>
                The Art of the<br /><em>Hand-Torn Edge</em>
              </h2>
              <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--taupe)', lineHeight: 2.2, marginBottom: 16 }}>
                Each ribbon is carefully hand-torn to create naturally frayed edges that celebrate the beauty of imperfection.
              </p>
              <p style={{ fontSize: 15, fontWeight: 400, color: 'var(--taupe)', lineHeight: 2.2 }}>
                The result is something you feel before you see: a quiet luxury in the hands, a weight that speaks of care, and an edge that tells the story of how it was made.
              </p>
            </div>
            <div style={{ aspectRatio: '1/1', overflow: 'hidden', position: 'relative' }}>
              {images.length > 0 && (
                <NextImage src={images[images.length > 1 ? 1 : 0]} alt={imageAlt(product, images.length > 1 ? 1 : 0, images.length)}
                  fill sizes="(max-width: 600px) 50vw, 25vw"
                  style={{ objectFit: 'cover' }} loading="lazy" />
              )}
            </div>
          </div>
        </div>

        }
        <nav className="product-guide-links" aria-label="Product guides">
          {['fine-silk-ribbons', 'hand-frayed-silk-ribbons', 'vintage-inspired-ribbons'].includes(collectionSlug) && <>
            <Link href="/ribbon-guide">Choosing ribbon width and length</Link>
            <Link href="/care-guide">Caring for silk ribbon</Link>
          </>}
          <Link href={`/collections/${collectionSlug}`}>Browse {collectionName}</Link>
          <Link href="/shipping-returns">Delivery &amp; returns</Link>
        </nav>

        {/* More from this collection — 只在同系列真的还有别的商品时才渲染，避免空占位 */}
        {relatedProducts.length > 0 && (
          <div style={{ borderTop: '1px solid var(--sand)', padding: '80px 60px 100px' }} className="related-pad">
            <div style={{ maxWidth: 1360, margin: '0 auto' }}>
              <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12, textAlign: 'center' }}>
                {collectionName}
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', textAlign: 'center', marginBottom: 48 }}>
                More from this Collection
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 280px))', justifyContent: 'center', gap: 32 }} className="related-grid">
                {relatedProducts.map(p => (
                  <Link key={p.id} href={`/collections/${collectionSlug}/${p.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ aspectRatio: '1/1', background: 'var(--sand)', marginBottom: 14, overflow: 'hidden', position: 'relative' }}>
                      {Array.isArray(p.images) && p.images[0] && (
                        <NextImage src={p.images[0]} alt={imageAlt(p)} fill sizes="(max-width: 768px) 50vw, 25vw" style={{ objectFit: 'cover' }} loading="lazy" />
                      )}
                    </div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>{safe(p.name)}</p>
                    <p style={{ fontSize: 12, color: 'var(--taupe)' }}>{p.price > 0 ? fmt(p.price) : ''}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .main-wrap:hover .main-img-hover { transform: scale(1.04); }
        .product-guide-links { max-width: 980px; margin: 0 auto; padding: 32px var(--page-padding); display: flex; flex-wrap: wrap; gap: 8px 28px; }
        .product-guide-links a { display: inline-flex; align-items: center; min-height: 44px; color: var(--deep); font-size: 14px; line-height: 1.6; text-decoration: underline; text-underline-offset: 4px; overflow-wrap: anywhere; }
        @media(max-width: 960px) {
          .zone1 { grid-template-columns: 1fr !important; gap: 40px !important; padding: 32px 24px !important; }
          .desc-grid { grid-template-columns: 1fr !important; }
          .story-grid { grid-template-columns: 1fr !important; gap: 48px !important; padding: 60px 24px !important; }
          .bc-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .zone2-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .related-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .related-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 220px)) !important; gap: 20px !important; }
        }
        .first-section-title { margin-top: 0 !important; }
        .zone1 > * { min-width: 0; }
        .product-title { overflow-wrap: anywhere; }
        .product-thumbnails { position: relative; overscroll-behavior-x: contain; }
        @media (hover: none) { .main-wrap:hover .main-img-hover { transform: none; } }
        @media (max-width: 600px) {
          .zone1 { padding: 24px 20px 40px !important; gap: 28px !important; }
          .product-title { font-size: 28px !important; line-height: 1.2 !important; margin-bottom: 20px !important; }
          .zone1 select { min-height: 48px; }
          .product-buy-controls { flex-wrap: wrap; height: auto !important; gap: 12px; }
          .product-buy-controls > div { height: 48px; border-right: 1px solid var(--warm) !important; }
          .product-buy-controls > button { flex-basis: 100% !important; min-height: 50px; font-size: 11px !important; letter-spacing: .18em !important; }
          .product-detail-tabs { gap: 0; margin-bottom: 32px !important; }
          .product-detail-tabs button { flex: 1; margin-left: 0 !important; margin-right: 0 !important; min-height: 48px; letter-spacing: .12em !important; }
          .zone2-pad, .related-pad { padding: 48px 20px !important; }
          .desc-grid { gap: 28px !important; overflow-wrap: anywhere; }
          .related-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; gap: 24px 12px !important; }
        }
      ` }} />
    </>
  )
}
