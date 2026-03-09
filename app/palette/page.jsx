'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function safe(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function Palette() {
  const [products, setProducts] = useState([])
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .order('name')
      const { data: skuData } = await supabase
        .from('product_skus')
        .select('product_id, colour, colour_hex')
      setProducts(prods || [])
      setSkus(skuData || [])
      setLoading(false)
    }
    load()
  }, [])

  // Build flat list: one entry per unique product+colour combo
  const entries = []
  const seen = new Set()
  for (const sku of skus) {
    const key = `${sku.product_id}__${safe(sku.colour)}`
    if (seen.has(key)) continue
    seen.add(key)
    const product = products.find(p => p.id === sku.product_id)
    if (!product) continue
    entries.push({
      productSlug: safe(product.slug),
      productName: safe(product.name),
      colour: safe(sku.colour),
      hex: safe(sku.colour_hex) || '#D4C5B0',
      image: Array.isArray(product.images) ? product.images[0] : null,
    })
  }

  // Sort dark to light by perceived luminance
  entries.sort((a, b) => {
    const lum = hex => {
      const c = hex.replace('#','')
      if (c.length < 6) return 128
      return 0.299*parseInt(c.slice(0,2),16) + 0.587*parseInt(c.slice(2,4),16) + 0.114*parseInt(c.slice(4,6),16)
    }
    return lum(a.hex) - lum(b.hex)
  })

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>One Silk Ribbon</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)', marginBottom: 20 }}>
            The Palette
          </h1>
          <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 1.9, maxWidth: 480 }}>
            Every colourway we make — naturally dyed, hand-finished, and named for what inspired it.
          </p>
        </div>

        {/* Grid */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '64px 60px 120px' }} className="palette-pad">

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--taupe)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>Loading the palette…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 24 }} className="swatches-grid">
                {entries.map(({ productSlug, productName, colour, hex, image }, i) => {
                  const id = `${productSlug}-${colour}`
                  const isHovered = hovered === id
                  return (
                    <Link key={`${id}-${i}`} href={`/products/${productSlug}`} style={{ textDecoration: 'none' }}>
                      <div
                        onMouseEnter={() => setHovered(id)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{
                          width: '100%', aspectRatio: '1 / 1.3', overflow: 'hidden',
                          background: hex, position: 'relative',
                          transition: 'transform .3s ease, box-shadow .3s ease',
                          transform: isHovered ? 'translateY(-4px)' : 'none',
                          boxShadow: isHovered ? '0 12px 32px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
                        }}>
                          {image && (
                            <img src={image} alt={colour} style={{
                              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                              mixBlendMode: 'multiply',
                              opacity: isHovered ? 0.85 : 0.55,
                              transition: 'opacity .3s',
                            }} />
                          )}
                        </div>
                        <div style={{ paddingTop: 12 }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 300, color: 'var(--ink)', marginBottom: 3, lineHeight: 1.3 }}>{colour}</p>
                          <p style={{ fontSize: 9, color: 'var(--taupe)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{productName}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
              {entries.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--warm)', letterSpacing: '.08em', fontStyle: 'italic', marginTop: 72 }}>
                  {entries.length} colourways available — more in development.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width: 768px) {
          .palette-pad { padding: 48px 24px 80px !important; }
          .swatches-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important; gap: 16px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </>
  )
}
