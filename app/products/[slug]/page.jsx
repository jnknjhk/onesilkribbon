'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'

// --- 实用工具函数 ---
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
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div className="loading-state">
      <div className="loading-line"></div>
      <p>Refining Selection…</p>
    </div>
  )

  if (!product) return (
    <div className="error-state">
      <p>The piece you are looking for is currently unavailable.</p>
      <Link href="/collections" className="link-back">Return to Collections</Link>
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
  const collectionName = safe(product.collection).replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const inStock = selectedSku ? safeNum(selectedSku.stock_qty) > 0 : false

  // 提取唯一颜色和宽度
  const uniqueColours = Array.from(new Set(skus.map(s => s.colour))).map(c => skus.find(s => s.colour === c))
  const uniqueWidths = Array.from(new Set(skus.map(s => s.width_mm))).filter(Boolean).sort((a, b) => a - b)

  return (
    <>
      <main className="pp-container">
        {/* 顶部面包屑 - 更加纤细隐形 */}
        <nav className="pp-breadcrumb">
          <Link href="/collections">Archive</Link>
          <span>/</span>
          <Link href={`/collections/${product.collection}`}>{collectionName}</Link>
          <span>/</span>
          <span className="current">{product.name}</span>
        </nav>

        <div className="pp-main-grid">
          
          {/* 左侧：图片瀑布流展示 - 核心高级感来源 */}
          <div className="pp-gallery-scroll">
            {images.map((img, i) => (
              <div key={i} className="pp-image-wrapper" onClick={() => setZoomedImg(img)}>
                <img src={img} alt={`${product.name} detail ${i}`} loading="lazy" />
              </div>
            ))}
            {images.length === 0 && <div className="pp-image-placeholder" />}
          </div>

          {/* 右侧：固定悬浮的信息面板 */}
          <div className="pp-details-sticky">
            <div className="pp-details-inner">
              
              <header className="pp-header">
                <p className="pp-collection-tag">{collectionName}</p>
                <h1 className="pp-title">{product.name}</h1>
                <div className="pp-price-row">
                  <span className="pp-price">{fmt(price)}</span>
                  <span className="pp-vat-label">VAT Included</span>
                </div>
              </header>

              <div className="pp-selectors">
                {/* 宽度选择 - 极简文字排版 */}
                {uniqueWidths.length > 1 && (
                  <div className="pp-selector-group">
                    <label>Select Width — {selectedSku?.width_mm}mm</label>
                    <div className="pp-width-options">
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

                {/* 颜色选择 - 圆点微交互 */}
                {uniqueColours.length > 1 && (
                  <div className="pp-selector-group">
                    <label>Palette — {selectedSku?.colour}</label>
                    <div className="pp-colour-options">
                      {uniqueColours.map(c => (
                        <button
                          key={c.id}
                          title={c.colour}
                          onClick={() => setSelectedSku(skus.find(s => s.colour === c.colour && s.width_mm === (selectedSku?.width_mm || skus[0].width_mm)))}
                          style={{ background: safe(c.colour_hex) || '#D4C5B0' }}
                          className={selectedSku?.colour === c.colour ? 'active' : ''}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 购买与数量控制 */}
              <div className="pp-action-area">
                <div className="pp-qty-stepper">
                  <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty(qty + 1)}>+</button>
                </div>
                <button 
                  className={`pp-add-button ${added ? 'is-added' : ''}`}
                  onClick={handleAdd}
                  disabled={!selectedSku || !inStock}
                >
                  {added ? 'Added to Archive' : (!inStock ? 'Waitlist Only' : 'Add to Basket')}
                </button>
              </div>

              <p className="pp-shipping-nudge">
                Complementary UK shipping on orders over £45. <br/>
                Artisanally prepared and dispatched in 2–3 business days.
              </p>

              {/* 信息手风琴 - 垂直排版更具叙事感 */}
              <div className="pp-info-sections">
                <details open>
                  <summary>The Essence</summary>
                  <div className="pp-content" dangerouslySetInnerHTML={{ __html: safe(product.description).replace(/\n/g, '<br/>') }} />
                </details>
                <details>
                  <summary>Care & Preservation</summary>
                  <div className="pp-content">
                    <p>Treat this silk as an heirloom. Hand wash in cool water with pH-neutral soap. Lay flat to dry, away from the embrace of direct sunlight. Iron while damp on the lowest silk setting.</p>
                  </div>
                </details>
                <details>
                  <summary>Delivery & Origin</summary>
                  <div className="pp-content">
                    <p>UK Standard — 3–5 working days<br/>International — 7–14 working days<br/>Custom duties may apply for international collectors.</p>
                  </div>
                </details>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* 图片放大遮罩 */}
      {zoomedImg && (
        <div className="pp-lightbox" onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} alt="Zoomed view" />
          <button className="pp-lightbox-close">✕</button>
        </div>
      )}

      <style jsx>{`
        /* 变量定义 - 建议放在全局，此处为演示 */
        :root {
          --cream: #F9F7F4;
          --sand: #F0EBE5;
          --taupe: #8C8279;
          --ink: #1C1917;
          --gold: #A69177;
          --font-serif: "Cormorant Garamond", "Playfair Display", serif;
        }

        .pp-container {
          background: var(--cream);
          min-height: 100vh;
          padding-top: 60px;
          color: var(--ink);
        }

        /* 面包屑 */
        .pp-breadcrumb {
          padding: 20px 40px;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          display: flex;
          gap: 12px;
          color: var(--taupe);
        }
        .pp-breadcrumb a { color: inherit; text-decoration: none; transition: color 0.3s; }
        .pp-breadcrumb a:hover { color: var(--ink); }
        .pp-breadcrumb .current { color: var(--ink); opacity: 0.8; }

        /* 主网格布局 */
        .pp-main-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 0;
        }

        /* 左侧瀑布流图片 */
        .pp-gallery-scroll {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pp-image-wrapper {
          width: 100%;
          cursor: zoom-in;
          overflow: hidden;
          background: var(--sand);
        }
        .pp-image-wrapper img {
          width: 100%;
          display: block;
          transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pp-image-wrapper:hover img {
          transform: scale(1.04);
        }

        /* 右侧固定详情区 */
        .pp-details-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          scrollbar-width: none; /* Hide scrollbar Firefox */
        }
        .pp-details-sticky::-webkit-scrollbar { display: none; } /* Hide scrollbar Chrome/Safari */
        
        .pp-details-inner {
          padding: 80px 12% 120px;
          max-width: 600px;
        }

        .pp-collection-tag {
          font-size: 11px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 16px;
        }
        .pp-title {
          font-family: var(--font-serif);
          font-size: 36px;
          font-weight: 300;
          line-height: 1.2;
          margin-bottom: 24px;
        }
        .pp-price-row {
          display: flex;
          align-items: baseline;
          gap: 15px;
          margin-bottom: 60px;
        }
        .pp-price { font-size: 22px; font-weight: 300; }
        .pp-vat-label { font-size: 10px; color: var(--taupe); text-transform: uppercase; letter-spacing: 0.1em; }

        /* 选择器样式 */
        .pp-selector-group { margin-bottom: 40px; }
        .pp-selector-group label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 15px;
          color: var(--taupe);
        }
        
        .pp-width-options { display: flex; gap: 10px; }
        .pp-width-options button {
          background: none;
          border: 1px solid var(--sand);
          padding: 8px 16px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .pp-width-options button.active { border-color: var(--ink); background: var(--ink); color: #fff; }

        .pp-colour-options { display: flex; gap: 12px; flex-wrap: wrap; }
        .pp-colour-options button {
          width: 28px; height: 28px; border-radius: 50%; border: none;
          cursor: pointer; position: relative; transition: transform 0.3s;
        }
        .pp-colour-options button.active::after {
          content: ''; position: absolute; inset: -4px;
          border: 1px solid var(--gold); border-radius: 50%;
        }

        /* 动作按钮 */
        .pp-action-area {
          display: flex;
          height: 54px;
          margin-bottom: 20px;
          background: #fff;
        }
        .pp-qty-stepper {
          display: flex; align-items: center; border: 1px solid var(--sand);
        }
        .pp-qty-stepper button {
          width: 40px; height: 100%; background: none; border: none; cursor: pointer;
        }
        .pp-qty-stepper span { width: 30px; text-align: center; font-size: 13px; }

        .pp-add-button {
          flex: 1; border: none; background: var(--ink); color: #fff;
          text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px;
          cursor: pointer; transition: all 0.4s;
        }
        .pp-add-button:hover { opacity: 0.9; }
        .pp-add-button.is-added { background: var(--gold); }

        .pp-shipping-nudge {
          font-size: 11px; line-height: 1.6; color: var(--taupe);
          margin-bottom: 80px; font-style: italic;
        }

        /* 手风琴信息区 */
        .pp-info-sections details {
          border-top: 1px solid var(--sand);
        }
        .pp-info-sections summary {
          padding: 20px 0; list-style: none; cursor: pointer;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;
          display: flex; justify-content: space-between; align-items: center;
        }
        .pp-info-sections summary::after { content: '+'; font-weight: 300; }
        .pp-info-sections details[open] summary::after { content: '−'; }
        .pp-content {
          padding-bottom: 30px; font-size: 13px; line-height: 1.8; color: var(--taupe);
        }

        /* 灯箱 */
        .pp-lightbox {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(255,255,255,0.98);
          display: flex; align-items: center; justifyContent: center; cursor: zoom-out;
        }
        .pp-lightbox img { max-width: 90%; max-height: 90vh; object-fit: contain; }
        .pp-lightbox-close {
          position: absolute; top: 30px; right: 40px; background: none; border: none; font-size: 20px; cursor: pointer;
        }

        /* 移动端适配 */
        @media (max-width: 1024px) {
          .pp-main-grid { grid-template-columns: 1fr; }
          .pp-details-sticky { height: auto; position: relative; }
          .pp-details-inner { padding: 40px 24px; }
          .pp-gallery-scroll { flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; }
          .pp-image-wrapper { flex: 0 0 85%; scroll-snap-align: center; }
        }

        /* 加载态微动效 */
        .loading-state {
          height: 100vh; display: flex; flex-direction: column; align-items: center;
          justify-content: center; background: var(--cream);
        }
        .loading-line {
          width: 40px; height: 1px; background: var(--gold);
          animation: loading-grow 1.5s infinite ease-in-out;
        }
        @keyframes loading-grow {
          0% { transform: scaleX(0.5); opacity: 0.3; }
          50% { transform: scaleX(2); opacity: 1; }
          100% { transform: scaleX(0.5); opacity: 0.3; }
        }
        .loading-state p {
          margin-top: 20px; font-family: var(--font-serif); font-size: 18px; color: var(--taupe); font-style: italic;
        }
      `}</style>
    </>
  )
}