'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { COLLECTION_META } from '@/lib/collection-content'
import { RIBBON_HOUSES, RIBBON_HOUSE_SLUGS } from '@/lib/storefront-nav'
import { formatGBP } from '@/lib/pricing'
import FabricCollectionClient from '@/components/fabric/FabricCollectionClient'

function safe(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function safeNum(value) {
  const number = parseFloat(value)
  return Number.isNaN(number) ? 0 : number
}

export default function CollectionClient({ initialProducts, slug: initialSlug, initialHeroImage = null, relatedArticle = null }) {
  const slug = initialSlug || ''
  const products = initialProducts || []
  const [sort, setSort] = useState('default')
  const heroImg = initialHeroImage

  const meta = COLLECTION_META[slug] || { name: slug, desc: '', bg: 'var(--osr-paper-2)' }

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price-asc') return a.lowestPrice - b.lowestPrice
    if (sort === 'price-desc') return b.lowestPrice - a.lowestPrice
    if (sort === 'name') return safe(a.name).localeCompare(safe(b.name))
    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
  })

  return (
    <div className="coll-page">
      <header className="coll-hero">
        {heroImg ? (
          <Image
            src={heroImg}
            alt={meta.name}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="coll-hero-fallback" style={{ background: meta.bg }} />
        )}
        <div className="coll-hero-overlay" />
        <div className="coll-hero-inner">
          <p className="coll-crumb">
            <Link href="/collections">Collections</Link>
            <span style={{ margin: '0 10px', opacity: 0.5 }}>—</span>
            {meta.name}
          </p>
          <h1>{meta.name}</h1>
          <div className="coll-hero-rule" />
          <p className="coll-hero-desc">{meta.desc}</p>
        </div>
      </header>

      <div className="coll-body">
        {slug === 'silk-fabric' ? (
          <>
            <FabricCollectionClient products={products} />
            {products.length > 0 && <CollectionGuide meta={meta} relatedArticle={relatedArticle} slug={slug} />}
          </>
        ) : (
          <>
        {RIBBON_HOUSE_SLUGS.includes(slug) && (
          <nav className="coll-house-nav" aria-label="Ribbon houses">
            {RIBBON_HOUSES.map(house => (
              <Link
                key={house.slug}
                href={house.href}
                aria-current={house.slug === slug ? 'page' : undefined}
              >
                {house.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="coll-toolbar">
          <span>{sorted.length} {sorted.length === 1 ? 'product' : 'products'}</span>
          <div className="coll-sort">
            <label htmlFor="collection-sort">Sort</label>
            <select id="collection-sort" aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}>
              <option value="default">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="coll-empty">No products found</p>
        ) : (
          <div className="coll-grid">
            {sorted.map(product => {
              const image = Array.isArray(product.images) ? product.images[0] : null
              const price = safeNum(product.lowestPrice)
              const name = safe(product.name)
              const productSlug = safe(product.slug)
              return (
                <Link key={safe(product.id)} href={`/collections/${safe(product.collection)}/${productSlug}`} className="coll-card">
                  <div className="coll-card-media">
                    {image ? (
                      <Image
                        src={image}
                        alt={name}
                        fill
                        sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(170deg,#E8DDD0,#C4A882)' }} />
                    )}
                    <span className="osr-badge osr-badge--ink">Live product</span>
                  </div>
                  <div className="coll-card-body">
                    <h3>{name}</h3>
                    {price > 0 && <p>From {formatGBP(price)}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {slug === 'fine-silk-ribbons' && (
          <aside className="coll-cross" aria-labelledby="coll-cross-title">
            <div>
              <span className="osr-eyebrow">The workbench</span>
              <h2 id="coll-cross-title">Tools for ribbon embroidery.</h2>
              <p>
                Beechwood hoops, ribbon spools and a tabletop embroidery stand. The studio tools are part of the same collection and can be reached from the fine ribbon you are already using.
              </p>
            </div>
            <Link className="osr-btn osr-btn--outline" href="/collections/studio-tools">Enter Studio Tools</Link>
          </aside>
        )}

        {products.length > 0 && <CollectionGuide meta={meta} relatedArticle={relatedArticle} slug={slug} />}
          </>
        )}
      </div>
    </div>
  )
}

function CollectionGuide({ meta, relatedArticle, slug }) {
  if (!meta?.guidance?.length) return null
  return (
    <section className="coll-guide" aria-labelledby="collection-guide-title">
      <h2 id="collection-guide-title">{meta.guideTitle}</h2>
      <div className="coll-guide-cols">
        {meta.guidance.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <p className="coll-guide-links">
        {slug !== 'silk-fabric' && <Link href="/ribbon-guide">Help choosing ribbon</Link>}
        {relatedArticle && <Link href={`/journal/${relatedArticle.slug}`}>{relatedArticle.title}</Link>}
        <Link href="/care-guide">Silk care guide</Link>
        <Link href="/shipping-returns">Delivery &amp; returns</Link>
      </p>
    </section>
  )
}
