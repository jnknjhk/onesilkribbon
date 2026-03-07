'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart'

// --- 工具函数 ---
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
  const [mainImg, setMainImg] = useState(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem } = useCart()
  const scrollRef = useRef(null)

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
        if (prod.images?.length > 0) setMainImg(prod.images[0])
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return <div className="loader">Artisan Archive Loading...</div>

  if (!product) return <div className="loader">Product not found.</div>

  const handleAdd = () => {
    if (!selectedSku) return
    addItem({
      skuId: safe(selectedSku.id),
      productId: safe(product.id),
      name: safe(product.name),
      skuDesc: `${safe(selectedSku.colour)} ${selectedSku.width_mm ? `· ${selectedSku.width_mm}mm` : ''}`,
      colour: safe(selectedSku.colour),
      colourHex: safe(selectedSku.colour_hex),
      price: safeNum(selectedSku.price_gbp),
      qty,
      image: mainImg,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const images = Array.isArray(product.images) ? product.images : []
  const collectionName = safe(product.collection).replace(/-/g, ' ')
  const price = selectedSku ? safeNum(selectedSku.price_gbp) : 0
  const inStock = selectedSku ? safeNum(selectedSku.stock_qty) > 0 : false

  // 筛选唯一选项
  const uniqueColours = Array.from(new Set(skus.map(s => s.colour))).map(c => skus.find(s => s.colour === c))
  const uniqueWidths = Array.from(new Set(skus.map(s => s.width_mm))).filter(Boolean).sort((a, b) => a - b)

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Inter:wght@300;400&display=swap" rel="stylesheet" />

      <div className="v3-wrapper">
        {/* 顶部面包屑 - 确保在 Header 之下 */}
        <nav className="v3-nav">
          <Link href="/collections">Archive</Link> / <span>{collectionName}</span>
        </nav>

        <div className="v3-container">
          {/* 左侧：画廊区 - 解决了拉得太长的问题 */}
          <div className="v3-gallery-section">
            <div className="v3-main-stage">
              <img src={mainImg} alt={product.name} />
            </div>
            <div className="v3-thumb-grid">
              {images.map((img, i) => (
                <div 
                  key={i} 
                  className={`v3-thumb ${mainImg === img ? 'active' : ''}`}
                  onClick={() => setMainImg(img)}
                >
                  <img src={img} alt="" />
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：信息区 - 始终吸附且不遮挡 */}
          <aside className="v3-info-panel">
            <div className="v3-sticky-content">
              <div className="v3-header">
                <p className="v3-tag">{collectionName}</p>
                <h1 className="v3-title">{product.name}</h1>
                <p className="v3-price">{fmt(price)}</p>
              </div>

              <div className="v3-options">
                {/* 宽度选择 */}
                {uniqueWidths.length > 1 && (
                  <div className="v3-group">
                    <label>Width <span>{selectedSku?.width_mm}mm</span></label>
                    <div className="v3-pills">
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

                {/* 颜色选择 */}
                {uniqueColours.length > 1 && (
                  <div className="v3-group">
                    <label>Colour <span>{selectedSku?.colour}</span></label>
                    <div className="v3-swatches">
                      {uniqueColours.map(c => (
                        <button
                          key={c.id}
                          className={selectedSku?.colour === c.colour ? 'active' : ''}
                          onClick={() => setSelectedSku(skus.find(s => s.colour === c.colour && s.width_mm === (selectedSku?.width_mm || skus[0].width_mm)))}
                          style={{ '--hex': c.colour_hex || '#e5e5e5' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 核心动作 */}
              <div className="v3-buy-box">
                <div className="v3-qty">
                  <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty(qty + 1)}>+</button>
                </div>
                <button 
                  className={`v3-add-btn ${added ? 'success' : ''}`}
                  onClick={handleAdd}
                  disabled={!inStock}
                >
                  {added ? 'Added to Basket' : inStock ? 'Add to Basket' : 'Sold Out'}
                </button>
              </div>

              {/* 品牌叙事手风琴 */}
              <div className="v3-accordion">
                <details open>
                  <summary>Details</summary>
                  <div className="v3-text" dangerouslySetInnerHTML={{ __html: safe(product.description) }} />
                </details>
                <details>
                  <summary>Shipping & Returns</summary>
                  <div className="v3-text">
                    Complimentary UK delivery on orders over £45. We ship globally with sustainable packaging.
                  </div>
                </details>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --v3-bg: #ffffff;
          --v3-ink: #111111;
          --v3-grey: #757575;
          --v3-line: #eeeeee;
          --v3-accent: #a69177;
          --v3-serif: 'Cormorant Garamond', serif;
          --v3-sans: 'Inter', sans-serif;
        }

        .v3-wrapper {
          background: var(--v3-bg);
          padding-top: 80px; /* 预留给标头的空间，防止覆盖 */
          min-height: 100vh;
        }

        .v3-nav {
          padding: 20px 5%;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--v3-grey);
          border-bottom: 1px solid var(--v3-line);
        }
        .v3-nav span { color: var(--v3-ink); }
        .v3-nav a { color: inherit; text-decoration: none; }

        .v3-container {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          max-width: 1600px;
          margin: 0 auto;
        }

        /* 画廊 */
        .v3-gallery-section {
          padding: 40px 5%;
          border-right: 1px solid var(--v3-line);
        }
        .v3-main-stage {
          aspect-ratio: 4/5;
          background: #fbfbfb;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .v3-main-stage img { width: 100%; height: 100%; object-fit: cover; }
        
        .v3-thumb-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }
        .v3-thumb {
          aspect-ratio: 1;
          cursor: pointer;
          opacity: 0.6;
          transition: 0.3s;
          border: 1px solid transparent;
        }
        .v3-thumb:hover, .v3-thumb.active { opacity: 1; border-color: var(--v3-ink); }
        .v3-thumb img { width: 100%; height: 100%; object-fit: cover; }

        /* 信息面板 */
        .v3-info-panel {
          padding: 60px 10%;
        }
        .v3-sticky-content {
          position: sticky;
          top: 120px;
        }

        .v3-tag { font-size: 12px; color: var(--v3-accent); text-transform: uppercase; margin-bottom: 8px; }
        .v3-title { font-family: var(--v3-serif); font-size: 42px; font-weight: 300; line-height: 1.1; margin-bottom: 15px; }
        .v3-price { font-size: 24px; font-weight: 300; margin-bottom: 40px; }

        .v3-group { margin-bottom: 35px; }
        .v3-group label { display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 15px; color: var(--v3-grey); }
        .v3-group label span { color: var(--v3-ink); margin-left: 10px; }

        .v3-pills { display: flex; gap: 8px; }
        .v3-pills button {
          border: 1px solid var(--v3-line); background: none; padding: 10px 20px; font-size: 13px; cursor: pointer;
        }
        .v3-pills button.active { background: var(--v3-ink); color: white; border-color: var(--v3-ink); }

        .v3-swatches { display: flex; gap: 12px; }
        .v3-swatches button {
          width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--v3-line);
          background: var(--hex); cursor: pointer; position: relative;
        }
        .v3-swatches button.active::after {
          content: ''; position: absolute; inset: -4px; border: 1px solid var(--v3-ink); border-radius: 50%;
        }

        .v3-buy-box { display: flex; gap: 10px; margin-top: 50px; height: 55px; }
        .v3-qty { display: flex; align-items: center; border: 1px solid var(--v3-line); }
        .v3-qty button { width: 40px; height: 100%; background: none; border: none; cursor: pointer; font-size: 18px; }
        .v3-qty span { width: 30px; text-align: center; font-size: 14px; }

        .v3-add-btn {
          flex: 1; background: var(--v3-ink); color: white; border: none;
          text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; cursor: pointer;
          transition: 0.3s;
        }
        .v3-add-btn:hover { opacity: 0.9; }
        .v3-add-btn.success { background: #2d5a27; }

        .v3-accordion { margin-top: 60px; border-top: 1px solid var(--v3-line); }
        .v3-accordion summary { 
          padding: 20px 0; list-style: none; font-size: 12px; text-transform: uppercase; 
          cursor: pointer; display: flex; justify-content: space-between;
        }
        .v3-accordion summary::after { content: '+'; }
        .v3-accordion details[open] summary::after { content: '-'; }
        .v3-text { padding-bottom: 20px; font-size: 14px; line-height: 1.6; color: var(--v3-grey); }

        @media (max-width: 900px) {
          .v3-container { grid-template-columns: 1fr; }
          .v3-gallery-section { border-right: none; border-bottom: 1px solid var(--v3-line); }
          .v3-sticky-content { position: static; }
          .v3-info-panel { padding: 40px 5%; }
        }

        .loader { height: 100vh; display: flex; align-items: center; justify-content: center; font-family: var(--v3-serif); font-style: italic; }
      `}</style>
    </>
  )
}