'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/lib/cart'
import { formatGBP, shippingDescription } from '@/lib/pricing'
import { fabricSkuDescription, fabricSpecRows } from '@/lib/fabric'
import { useShippingSettings } from '@/lib/use-shipping-settings'
import { STANDARD_RETURN_DAYS } from '@/lib/merchant-return-policy'

export default function FabricProductClient({ product, initialSkuId = '', initialShippingSettings, related = [] }) {
  const colours = product.fabric?.colours || []
  const [colourId, setColourId] = useState(() =>
    colours.find(item => item.skuId === initialSkuId)?.skuId || colours[0]?.skuId || ''
  )
  const [metres, setMetres] = useState('1')
  const [added, setAdded] = useState(false)
  const [error, setError] = useState('')
  const addedTimer = useRef(null)
  const { addItem, items } = useCart()
  const { settings: shippingSettings, error: shippingError } = useShippingSettings(initialShippingSettings)
  const colour = colours.find(item => item.skuId === colourId) || colours[0]

  useEffect(() => () => clearTimeout(addedTimer.current), [])

  const selectColour = skuId => {
    setColourId(skuId)
    setMetres('1')
    setError('')
  }

  if (!colour) {
    return (
      <div className="fabric-detail fabric-detail--empty">
        <p>This fabric has no available colour at the moment.</p>
        <Link className="osr-textlink" href="/collections/silk-fabric">Back to the fabric library</Link>
      </div>
    )
  }

  const inBasket = items?.find(item => item.skuId === colour.skuId)?.qty || 0
  const availableStock = Math.max(0, colour.stock - inBasket)
  const maxCut = product.fabric.maxCutM
  const cutRemaining = maxCut ? Math.max(0, maxCut - inBasket) : 0
  const limit = Math.min(availableStock, cutRemaining)
  const parsed = Number(metres)
  const valid = Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= limit
  const total = valid ? colour.price * parsed : 0
  const canBuy = valid && limit > 0
  const specs = fabricSpecRows(product)
  const images = product.images || []
  const image = colour.image || images[0] || null

  const step = delta => {
    if (!limit) return
    const base = Number.isSafeInteger(parsed) ? parsed : 1
    const next = Math.min(limit, Math.max(1, base + delta))
    setMetres(String(next))
  }

  const addCut = () => {
    if (!canBuy) return
    const item = {
      skuId: colour.skuId,
      productId: product.id,
      name: product.name,
      skuDesc: fabricSkuDescription(product, { colour: colour.name }),
      colour: colour.name,
      colourHex: colour.hex,
      price: colour.price,
      qty: parsed,
      stockQty: Math.min(colour.stock, maxCut || 0),
      image,
      unit: 'm',
    }
    if (addItem(item) === false) {
      setError('The available stock changed. Please reduce the metres or refresh the page.')
      return
    }
    setError('')
    setAdded(true)
    clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="fabric-detail">
      <div className="fabric-detail-media">
        <div className="fabric-detail-media-frame">
          {image ? (
            <Image src={image} alt={product.name} fill priority sizes="(max-width: 960px) 100vw, 52vw" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="fabric-media-fallback" aria-hidden="true" />
          )}
          <span className="osr-badge osr-badge--ink">Sold by the metre</span>
        </div>
        <div className="fabric-detail-media-note">
          <span>{colour.name}{product.fabric.width ? ` · ${product.fabric.width} wide` : ''}</span>
          <span className="fabric-colour-dot" style={{ background: colour.hex }} aria-hidden="true" />
        </div>
      </div>

      <div className="fabric-detail-panel">
        <p className="fabric-crumb">
          <Link href="/collections">Collections</Link>
          <span aria-hidden="true">—</span>
          <Link href="/collections/silk-fabric">Silk Fabric by the Metre</Link>
        </p>
        <span className="osr-eyebrow">Silk Fabric by the Metre</span>
        <h1>{product.name}</h1>
        {product.descriptionHtml ? (
          <div className="fabric-detail-desc" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        ) : (
          <p className="fabric-detail-desc">{product.description}</p>
        )}

        <div className="fabric-detail-price">
          <strong>{formatGBP(colour.price)}</strong>
          <span>per metre{product.fabric.width ? ` · ${product.fabric.width} wide` : ''} · cut to order</span>
        </div>

        <p className={`fabric-stock-note ${limit === 0 ? 'is-empty' : ''}`}>
          {!maxCut
            ? 'The maximum continuous cut is not configured for this fabric, so it cannot be ordered yet.'
            : limit === 0
              ? `No further continuous cut is available${availableStock > 0 ? ` (${availableStock} m in stock, ${cutRemaining} m left in the cut limit)` : ''}.`
              : `One continuous cut up to ${cutRemaining} m · ${availableStock} m available in ${colour.name}.`}
        </p>

        <div className="fabric-option-group">
          <div className="fabric-option-head">
            <strong>Colour</strong>
            <span>{colour.name}</span>
          </div>
          <div className="fabric-swatches">
            {colours.map(item => (
              <button key={item.skuId} type="button" className="fabric-swatch" aria-pressed={item.skuId === colour.skuId}
                onClick={() => selectColour(item.skuId)} style={{ '--swatch': item.hex }}>
                <i aria-hidden="true" />
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="fabric-option-group">
          <div className="fabric-option-head">
            <strong>Metres</strong>
            <span>Whole metres only · one continuous cut</span>
          </div>
          <div className="fabric-metres">
            <button type="button" onClick={() => step(-1)} aria-label="Decrease metres" disabled={!limit || parsed <= 1}>−</button>
            <input type="number" inputMode="numeric" min="1" max={limit || 1} step="1"
              value={metres} onChange={event => setMetres(event.target.value)}
              onBlur={() => { if (!valid && limit) setMetres(String(Math.min(Math.max(1, parsed || 1), limit))) }}
              aria-label="Metres of fabric" aria-invalid={!valid} aria-describedby="fabric-metres-note" disabled={!limit} />
            <span>metres</span>
            <button type="button" onClick={() => step(1)} aria-label="Increase metres" disabled={!limit || parsed >= limit}>+</button>
          </div>
          {limit > 0 && (
            <div className="fabric-quick-metres">
              {[1, 2, 3, 5].filter(value => value <= limit).map(value => (
                <button key={value} type="button" className="fabric-quick-metre" aria-pressed={parsed === value} onClick={() => setMetres(String(value))}>
                  {value} m
                </button>
              ))}
            </div>
          )}
          <p className="fabric-metres-note" id="fabric-metres-note">
            {limit > 0 ? `Choose 1–${limit} whole metres.` : 'Ordering is disabled until a cut length and stock are configured.'}
          </p>
        </div>

        <div className="fabric-total" aria-live="polite" aria-atomic="true">
          <span>Total</span>
          <div>
            <strong>{valid ? formatGBP(total) : '—'}</strong>
            <small>{valid ? `${parsed} m × ${formatGBP(colour.price)} per metre` : 'Choose a whole number of metres'}</small>
          </div>
        </div>

        <button type="button" className="fabric-add" onClick={addCut} disabled={!canBuy}>
          {added ? '✓ Added to Basket' : !maxCut ? 'Cut length not configured' : limit === 0 ? 'Sold Out' : 'Add to Basket'}
        </button>
        {error && <p className="fabric-error" role="alert">{error}</p>}

        <section className="fabric-delivery" aria-label="Delivery and cutting">
          <h2>Delivery before you order</h2>
          <p>{shippingSettings ? `Shipping is ${shippingDescription(shippingSettings)}.` : shippingError ? 'Delivery charges are currently unavailable.' : 'Loading delivery charges…'}</p>
          <p>Ships from our workshop in China. Usually dispatched within 2 business days after payment; estimated transit 5–14 days after dispatch.</p>
          <p>Cut in one continuous length up to the maximum shown. Standard products: request a return within {STANDARD_RETURN_DAYS} days of delivery. Faulty-item rights are unaffected.</p>
          <Link className="osr-textlink" href="/shipping-returns">Delivery, customs &amp; returns</Link>
        </section>

        <dl className="fabric-spec-table">
          {specs.map(([label, value]) => (
            <div key={label} className="fabric-spec-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="fabric-spec-row">
            <dt>Price</dt>
            <dd>{formatGBP(colour.price)} per metre</dd>
          </div>
          <div className="fabric-spec-row">
            <dt>Colours</dt>
            <dd>{colours.map(item => item.name).join(' · ')}</dd>
          </div>
        </dl>

        {related.length > 0 && (
          <section className="fabric-related" aria-labelledby="fabric-related-title">
            <div className="fabric-related-head">
              <h2 id="fabric-related-title">Other cloths to compare</h2>
              <Link className="osr-textlink" href="/collections/silk-fabric">All fabric</Link>
            </div>
            <div className="fabric-related-grid">
              {related.map(item => (
                <Link key={item.id} className="fabric-related-card" href={`/collections/silk-fabric/${item.slug}`}>
                  <div className="fabric-related-media">
                    {Array.isArray(item.images) && item.images[0] ? (
                      <Image src={item.images[0]} alt={item.name} fill sizes="160px" style={{ objectFit: 'cover' }} />
                    ) : <div className="fabric-media-fallback" aria-hidden="true" />}
                  </div>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.price > 0 ? `From ${formatGBP(item.price)} per metre` : 'View the cloth'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
