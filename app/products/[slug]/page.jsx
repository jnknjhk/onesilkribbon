'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'

// --- 实用工具函数 (保持不变) ---
const safe = (val) => (val === null || val === undefined ? '' : String(val))
const safeNum = (val) => {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}
const fmt = (amount) => '£' + safeNum(amount).toFixed(2)

export default function ProductPage({ params }) {
  const [slug, setSlug] = useState('')
  const [product, setProduct] = useState(null)
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [zoomedImg, setZoomedImg] = useState(null)
  const { addItem } = useCart()

  useEffect(() => {
    // 兼容 Next.js 动态路由和 window.location
    if (params?.slug) {
      setSlug(params.slug)
    } else {
      const parts = window.location.pathname.split('/')
      setSlug(parts[parts.length - 1] || '')
    }
  }, [params])

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
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div className="v2-loading">
      <div className="v2-loading-spinner"></div>
      <p style={{fontFamily:'var(--font-serif)', fontStyle:'italic', color:'var(--taupe)'}}>Awaiting Perfection…</p>
    </div>
  )

  if (!product) return (
    <div className="v2-error">
      <h2 style={{fontFamily:'var(--font-serif)', fontWeight:300}}>Piece Not Found</h2>
      <p>The requested artisanal ribbon is currently unavailable.</p>
      <Link href="/collections" className="v2-btn-secondary">Return to Collections</Link>
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
    setTimeout(() => setAdded(false), 2800)
  }

  const images = Array.isArray(product.images) ? product.images : []
  const collectionName = safe(product.collection).replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const inStock = selectedSku ? safeNum(selectedSku.stock_qty) > 0 : false

  // 提取唯一颜色和宽度
  const uniqueColours = Array.from(new Set(skus.map(s => s.colour))).map(c => skus.find(s => s.colour === c))
  const uniqueWidths = Array.from(new Set(skus.map(s => s.width_mm))).filter(Boolean).sort((a, b) => a - b)

  return (
    <>
      {/* 注入 Google Fonts - 必须使用优雅的衬线体 */}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Montserrat:wght@300;400&display=swap" rel="stylesheet" />

      <main className="v2-pp-layout">
        
        {/* 左侧：错落有致的沉浸式画廊 */}
        <div className="v2-gallery">
          {images.map((img, i) => (
            <div 
              key={i} 
              className={`v2-img-frame ${i % 2 === 0 ? 'v2-frame-portrait' : 'v2-frame-landscape'} fade-in-up`}
              style={{ animationDelay: `${i * 0.15}s` }}
              onClick={() => setZoomedImg(img)}
            >
              <img src={img} alt={`${product.name} artisanal detail ${i}`} loading="lazy" />
              <div className="v2-frame-overlay">Click to Enlarge</div>
            </div>
          ))}
          {images.length === 0 && <div className="v2-image-placeholder fade-in-up" />}
        </div>

        {/* 右侧：固定悬浮的奢华信息面板 */}
        <aside className="v2-details-sticky">
          <div className="v2-details-inner fade-in-up" style={{ animationDelay: '0.3s' }}>
            
            <header className="v2-header">
              <nav className="v2-breadcrumb">
                <Link href="/collections">Archive</Link> / <Link href={`/collections/${product.collection}`}>{collectionName}</Link>
              </nav>
              <p className="v2-collection-name">{collectionName}</p>
              <h1 className="v2-product-title">{product.name}</h1>
              
              <div className="v2-price-line">
                <span className="v2-price-amount">{fmt(price)}</span>
                <span className="v2-vat-note">Inc. VAT / {inStock ? 'In Stock' : 'Made to Order'}</span>
              </div>
            </header>

            {/* 选择器区域 */}
            <div className="v2-selectors">
              {/* 宽度：采用更有质感的极简按钮 */}
              {uniqueWidths.length > 1 && (
                <div className="v2-selector-group">
                  <label className="v2-label-micro">Width — {selectedSku?.width_mm}mm</label>
                  <div className="v2-width-pills">
                    {uniqueWidths.map(w => (
                      <button 
                        key={w} 
                        className={selectedSku?.width_mm === w ? 'active' : ''}
                        onClick={() => setSelectedSku(skus.find(s => s.width_mm === w && s.colour === (selectedSku?.colour || skus[0].colour)))}
                      >
                        {w}mm
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 颜色：带有精致边框的色块 */}
              {uniqueColours.length > 1 && (
                <div className="v2-selector-group">
                  <label className="v2-label-micro">Palette — {selectedSku?.colour}</label>
                  <div className="v2-colour-grid">
                    {uniqueColours.map(c => (
                      <button
                        key={c.id}
                        title={c.colour}
                        onClick={() => setSelectedSku(skus.find(s => s.colour === c.colour && s.width_mm === (selectedSku?.width_mm || skus[0].width_mm)))}
                        style={{ '--colour-hex': safe(c.colour_hex) || '#D4C5B0' }}
                        className={selectedSku?.colour === c.colour ? 'active' : ''}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 购买区域：更具仪式感 */}
            <div className="v2-purchase-area">
              <div className="v2-qty-selector">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span className="v2-qty-num">{qty}</span>
                <button onClick={() => setQty(qty + 1)}>+</button>
              </div>
              
              <button 
                className={`v2-btn-primary v2-shimmer-effect ${added ? 'is-added' : ''}`}
                onClick={handleAdd}
                disabled={!selectedSku}
              >
                <span className="v2-btn-text">
                  {added ? '✓ Added to Archive' : (!inStock ? 'Join Waitlist' : 'Add to Basket')}
                </span>
              </button>
            </div>

            <p className="v2-shipping-nudge">
              Complimentary UK shipping over £45. Dispatched within 2-3 artisan days.
            </p>

            {/* 信息手风琴：增加质感和行高 */}
            <div className="v2-accordion">
              <details open>
                <summary>The Artisan Story</summary>
                <div className="v2-accordion-content" dangerouslySetInnerHTML={{ __html: safe(product.description).replace(/\n/g, '<br/>') }} />
              </details>
              <details>
                <summary>Preservation Guide</summary>
                <div className="v2-accordion-content">
                  <p>As this is a vegetable-dyed, hand-torn silk, treat it as an heirloom. Hand wash gently in pH-neutral soap. Iron on a low setting while slightly damp to restore its lustre.</p>
                </div>
              </details>
            </div>

          </div>
        </aside>
      </main>

      {/* 奢华全屏图片灯箱 */}
      {zoomedImg && (
        <div className="v2-lightbox" onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} alt="Close-up artisanal detail" />
          <div className="v2-lightbox-close">Close</div>
        </div>
      )}

      {/* 注入此页面专属的高端样式 v2 */}
      <style jsx global>{`
        :root {
          --v2-cream: #FDFBFA; /* 更暖的奶油底色 */
          --v2-sand: #F5F1EB;   /* 用于对比的沙砾色 */
          --v2-taupe: #968C83;  /* 优雅的灰褐色 */
          --v2-ink: #1A1817;    /* 深邃但不死板的墨色 */
          --v2-gold: #B89F7D;   /* 更显奢华的哑光金 */
          --v2-border: #E8E2DA; /* 极细的边框颜色 */
          --v2-font-serif: 'Cormorant Garamond', serif;
          --v2-font-sans: 'Montserrat', sans-serif;
        }

        /* 动画基础 */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        body { background-color: var(--v2-cream); margin: 0; color: var(--v2-ink); font-family: var(--v2-font-sans); }

        .v2-pp-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr);
          min-height: 100vh;
        }

        /* 左侧画廊 - 错落排版 */
        .v2-gallery {
          display: flex;
          flex-direction: column;
          gap: 10px; /* 极小的间距，制造沉浸感 */
          padding: 10px;
          background-color: var(--v2-sand);
        }
        .v2-img-frame {
          width: 100%;
          position: relative;
          overflow: hidden;
          cursor: zoom-in;
          background: #fff;
        }
        .v2-img-frame img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .v2-img-frame:hover img { transform: scale(1.05); }

        /* 错落的画廊尺寸 */
        .v2-frame-portrait { aspect-ratio: 3/4; width: 90%; margin-left: auto; } /* 窄图靠右 */
        .v2-frame-landscape { aspect-ratio: 16/10; width: 100%; } /* 宽图占满 */
        .v2-frame-portrait:nth-child(even) { margin-left: 0; margin-right: auto; } /* 偶数 Narrow 靠左 */

        .v2-frame-overlay {
          position: absolute; bottom: 20px; right: 20px;
          background: rgba(255,255,255,0.8); backdrop-filter: blur(4px);
          padding: 6px 12px; font-size: 9px; text-transform: uppercase;
          letter-spacing: 0.2em; color: var(--v2-taupe); opacity: 0; transition: opacity 0.3s;
        }
        .v2-img-frame:hover .v2-frame-overlay { opacity: 1; }

        .v2-image-placeholder { aspect-ratio: 3/4; background: linear-gradient(135deg, #eee 0%, #ddd 100%); width: 100%; }

        /* 右侧详情 - 提升层次 */
        .v2-details-sticky {
          position: sticky; top: 0; height: 100vh;
          overflow-y: auto; scrollbar-width: none;
          background: var(--v2-cream);
          border-left: 1px solid var(--v2-border);
        }
        .v2-details-sticky::-webkit-scrollbar { display: none; }
        
        .v2-details-inner {
          padding: 80px 15% 120px; /* 增大留白 */
          max-width: 650px;
        }

        .v2-breadcrumb {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em;
          color: var(--v2-taupe); margin-bottom: 50px;
        }
        .v2-breadcrumb a { color: inherit; text-decoration: none; transition: color 0.3s; }
        .v2-breadcrumb a:hover { color: var(--v2-ink); }

        .v2-collection-name {
          font-size: 12px; text-transform: uppercase; letter-spacing: 0.3em;
          color: var(--v2-gold); font-weight: 400; margin-bottom: 12px;
        }
        .v2-product-title {
          font-family: var(--v2-font-serif);
          font-size: clamp(32px, 4vw, 48px); /* 动态大小标题 */
          font-weight: 300; line-height: 1.1; margin-bottom: 24px;
        }
        .v2-price-line {
          display: flex; align-items: baseline; gap: 15px;
          margin-bottom: 80px; padding-bottom: 20px; border-bottom: 1px solid var(--v2-border);
        }
        .v2-price-amount { font-family: var(--v2-font-serif); font-size: 30px; font-weight: 300; }
        .v2-vat-note { font-size: 11px; color: var(--v2-taupe); font-style: italic; }

        /* 选择器 v2 */
        .v2-selector-group { margin-bottom: 50px; }
        .v2-label-micro {
          display: block; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.2em; margin-bottom: 18px; color: var(--v2-taupe);
        }
        
        .v2-width-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .v2-width-pills button {
          background: #fff; border: 1px solid var(--v2-border);
          padding: 10px 22px; font-size: 12px; color: var(--v2-ink);
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 2px;
        }
        .v2-width-pills button.active { border-color: var(--v2-ink); background: var(--v2-ink); color: #fff; }
        .v2-width-pills button:hover:not(.active) { border-color: var(--v2-taupe); }

        .v2-colour-grid { display: flex; gap: 15px; flex-wrap: wrap; }
        .v2-colour-grid button {
          width: 38px; height: 38px; border-radius: 2px;
          background-color: var(--colour-hex);
          border: 1px solid rgba(0,0,0,0.05); /* 微小的内边框，模拟质感 */
          cursor: pointer; position: relative; transition: all 0.3s;
        }
        /* 选中的颜色增加金属质感边框 */
        .v2-colour-grid button.active {
          box-shadow: 0 0 0 2px var(--v2-cream), 0 0 0 3px var(--v2-gold);
          transform: translateY(-2px);
        }

        /* 购买区域 v2 */
        .v2-purchase-area {
          display: flex; gap: 15px; height: 58px; margin-bottom: 20px;
        }
        .v2-qty-selector {
          display: flex; align-items: center; background: #fff; border: 1px solid var(--v2-border); border-radius: 2px;
        }
        .v2-qty-selector button {
          width: 45px; height: 100%; background: none; border: none; cursor: pointer;
          font-size: 18px; color: var(--v2-taupe); transition: color 0.3s;
        }
        .v2-qty-selector button:hover { color: var(--v2-ink); }
        .v2-qty-num { width: 30px; text-align: center; font-size: 14px; font-weight: 300; }

        .v2-btn-primary {
          flex: 1; border: none; background: var(--v2-ink); color: #fff;
          text-transform: uppercase; letter-spacing: 0.25em; font-size: 11px;
          cursor: pointer; transition: all 0.4s; border-radius: 2px;
          position: relative; overflow: hidden;
        }
        .v2-btn-primary.is-added { background: var(--v2-gold); }
        .v2-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

        /* 微光掠过动效 */
        @keyframes shimmer { 100% { left: 125%; } }
        .v2-shimmer-effect::after {
          content: ""; position: absolute; top: -50%; left: -125%;
          width: 125%; height: 200%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
          transform: rotate(30deg);
        }
        .v2-btn-primary:hover:not(:disabled)::after {
          animation: shimmer 1s cubic-bezier(0.19, 1, 0.22, 1);
        }

        .v2-shipping-nudge {
          font-size: 11px; line-height: 1.7; color: var(--v2-taupe);
          margin-bottom: 90px; font-style: italic; font-weight: 300;
        }

        /* 信息手风琴 v2 */
        .v2-accordion details { border-top: 1px solid var(--v2-border); }
        .v2-accordion summary {
          padding: 24px 0; list-style: none; cursor: pointer;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;
          display: flex; justify-content: space-between; align-items: center; color: var(--v2-ink);
        }
        .v2-accordion summary::after { content: '→'; font-weight: 300; font-size: 14px; transition: transform 0.3s; }
        .v2-accordion details[open] summary::after { transform: rotate(90deg); }
        
        .v2-accordion-content {
          padding-bottom: 40px; font-size: 14px; line-height: 1.9; color: var(--v2-taupe);
          max-width: 500px; font-weight: 300;
        }
        .v2-accordion-content b { color: var(--v2-ink); font-weight: 400; }

        /* 奢华全屏灯箱 */
        .v2-lightbox {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(26,24,23,0.97); backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center; cursor: zoom-out;
          animation: fadeInUp 0.5s ease;
        }
        .v2-lightbox img { max-width: 90%; max-height: 90vh; object-fit: contain; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
        .v2-lightbox-close {
          position: absolute; top: 30px; right: 40px; color: #fff;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; cursor: pointer;
        }

        /* 移动端奢华适配 */
        @media (max-width: 1024px) {
          .v2-pp-layout { grid-template-columns: 1fr; }
          .v2-details-sticky { height: auto; position: relative; border-left: none; }
          .v2-details-inner { padding: 50px 24px; }
          .v2-gallery { flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0; gap: 0; }
          .v2-img-frame { flex: 0 0 100%; scroll-snap-align: center; aspect-ratio: 1/1 !important; width: 100% !important; margin: 0 !important; }
          .v2-frame-overlay { display: none; }
          .v2-price-line { margin-bottom: 50px; }
        }

        /* 重新设计的 Loading 和 Error */
        .v2-loading, .v2-error {
          height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: var(--v2-cream); color: var(--v2-taupe); gap: 20px; padding: 40px; text-align: center;
        }
        .v2-loading-spinner {
          width: 30px; height: 30px; border: 1px solid var(--v2-border); border-top-color: var(--v2-gold);
          border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .v2-btn-secondary {
          background: none; border: 1px solid var(--v2-border); padding: 12px 30px;
          color: var(--v2-ink); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
          text-decoration: none; border-radius: 2px; transition: all 0.3s;
        }
        .v2-btn-secondary:hover { border-color: var(--v2-ink); }
      `}</style>
    </>
  )
}