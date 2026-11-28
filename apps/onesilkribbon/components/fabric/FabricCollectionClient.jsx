'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { formatGBP } from '@/lib/pricing'
import { buildFabricFilters, filterFabricProducts } from '@/lib/fabric'
import Reveal from '@/components/home/Reveal'

const EMPTY = { type: '', use: '', weight: '', colour: '' }

const productHref = slug => `/collections/silk-fabric/${slug}`
const filterHref = (key, value) => `/collections/silk-fabric?${key}=${encodeURIComponent(value)}#fabric-library`

function FabricMedia({ src, alt, sizes, className = '' }) {
  if (!src) return <div className="fabric-media-fallback" aria-hidden="true" />
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} style={{ objectFit: 'cover' }} />
}

export default function FabricCollectionClient({ products = [] }) {
  const fabricProducts = useMemo(() => (products || []).filter(product => product.fabric), [products])
  const options = useMemo(() => buildFabricFilters(fabricProducts), [fabricProducts])
  const valid = useMemo(() => ({
    type: new Set(options.types.map(item => item.id)),
    use: new Set(options.uses.map(item => item.id)),
    weight: new Set(options.weights.map(item => item.id)),
    colour: new Set(options.colours.map(item => item.id)),
  }), [options])
  const [filters, setFilters] = useState(EMPTY)

  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search)
      const next = { ...EMPTY }
      for (const key of Object.keys(EMPTY)) {
        const value = params.get(key) || ''
        if (value && valid[key].has(value)) next[key] = value
      }
      setFilters(next)
    }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [valid])

  const filtered = useMemo(() => filterFabricProducts(fabricProducts, filters), [fabricProducts, filters])

  const update = next => {
    setFilters(next)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
    const query = params.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }

  const clear = () => update({ ...EMPTY })

  const choose = (key, value) => {
    update({ ...EMPTY, [key]: value })
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.requestAnimationFrame(() => {
      document.getElementById('fabric-library')?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    })
  }

  const active = [
    filters.type && { key: 'type', label: options.types.find(item => item.id === filters.type)?.label || filters.type },
    filters.use && { key: 'use', label: options.uses.find(item => item.id === filters.use)?.label || filters.use },
    filters.weight && { key: 'weight', label: options.weights.find(item => item.id === filters.weight)?.label || filters.weight },
    filters.colour && { key: 'colour', label: options.colours.find(item => item.id === filters.colour)?.label || filters.colour },
  ].filter(Boolean)

  if (fabricProducts.length === 0) {
    return (
      <div className="fabric-page">
        <section className="fabric-empty-room">
          <span className="osr-eyebrow">Silk Fabric by the Metre</span>
          <h2>The fabric room is being prepared.</h2>
          <p>No cloth has been published yet. The room will appear in the shop navigation when the first fabric is listed.</p>
          <Link className="osr-textlink" href="/collections">Back to collections</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="fabric-page">
      <section className="fabric-ways" aria-labelledby="fabric-ways-title">
          <span className="osr-eyebrow">Three ways in</span>
          <h2 className="osr-title osr-title--sm" id="fabric-ways-title">Begin with the cloth, the use, or the weight.</h2>
          <div className="fabric-way-grid">
            <a className="fabric-way-card" href="#by-type">
              <span>01</span>
              <strong>By Fabric Type</strong>
              <small>{options.types.length} types · chiffon, crêpe, charmeuse</small>
            </a>
            <a className="fabric-way-card" href="#by-use">
              <span>02</span>
              <strong>By Use</strong>
              <small>{options.uses.length} ways to make</small>
            </a>
            <a className="fabric-way-card" href="#by-weight">
              <span>03</span>
              <strong>By Weight</strong>
              <small>{options.weights.length} weights in momme</small>
            </a>
          </div>
        </section>

        {options.types.length > 0 && (
          <section className="fabric-section" id="by-type" aria-labelledby="fabric-type-title">
            <Reveal className="fabric-section-head">
              <div>
                <span className="osr-eyebrow">Way in 01</span>
                <h2 id="fabric-type-title">By Fabric Type</h2>
              </div>
              <p>Start with a cloth you know. Each type shows how many fabrics are cut to order in that weave.</p>
            </Reveal>
            <div className="fabric-type-grid">
              {options.types.map((type, index) => (
                <Reveal key={type.id} className="fabric-type-card" delay={index * 60}>
                  <Link href={filterHref('type', type.id)} onClick={event => { event.preventDefault(); choose('type', type.id) }}>
                    <div className="fabric-type-media">
                      <FabricMedia src={type.image} alt={`${type.label} silk fabric`} sizes="(max-width: 960px) 100vw, 33vw" />
                      <span className="osr-badge">{type.count} {type.count === 1 ? 'cloth' : 'cloths'}</span>
                    </div>
                    <h3>{type.label}</h3>
                    <p>Cut to order by the metre, in the colours currently in stock.</p>
                    <span className="osr-textlink">See the {type.label.toLowerCase()}</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {options.uses.length > 0 && (
          <section className="fabric-section" id="by-use" aria-labelledby="fabric-use-title">
            <Reveal className="fabric-section-head">
              <div>
                <span className="osr-eyebrow">Way in 02</span>
                <h2 id="fabric-use-title">By Use</h2>
              </div>
              <p>Start with what you want to make. Each use opens a short list of cloths to compare.</p>
            </Reveal>
            <div className="fabric-use-grid">
              {options.uses.map((use, index) => (
                <Reveal key={use.id} delay={index * 50}>
                  <Link className="fabric-use-card" href={filterHref('use', use.id)} onClick={event => { event.preventDefault(); choose('use', use.id) }}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{use.label}</h3>
                      <p>{use.count} suitable {use.count === 1 ? 'cloth' : 'cloths'}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {options.weights.length > 0 && (
          <section className="fabric-section" id="by-weight" aria-labelledby="fabric-weight-title">
            <Reveal className="fabric-section-head">
              <div>
                <span className="osr-eyebrow">Way in 03</span>
                <h2 id="fabric-weight-title">By Weight</h2>
              </div>
              <p>Momme measures weight per area. The number tells you how much silk is in the cloth; the hand and drape tell you what it will do.</p>
            </Reveal>
            <div className="fabric-weight-list">
              {options.weights.map(weight => (
                <Link key={weight.id} className="fabric-weight-row" href={filterHref('weight', weight.id)} onClick={event => { event.preventDefault(); choose('weight', weight.id) }}>
                  <div className="fabric-weight-media">
                    <FabricMedia src={weight.image} alt={`${weight.label} silk fabric`} sizes="120px" />
                  </div>
                  <h3>{weight.label}</h3>
                  <strong>{weight.range}</strong>
                  <p>{weight.note}</p>
                  <span className="osr-textlink">Browse {weight.count} {weight.count === 1 ? 'cloth' : 'cloths'}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="fabric-library" id="fabric-library" aria-labelledby="fabric-library-title">
          <div className="fabric-filter-panel" aria-label="Filter fabrics">
            <div className="fabric-filter-head">
              <strong>Refine</strong>
              {active.length > 0 && <button type="button" onClick={clear}>Clear all</button>}
            </div>
            <FilterGroup label="Fabric type" options={options.types} value={filters.type} onToggle={value => update({ ...filters, type: filters.type === value ? '' : value })} />
            <FilterGroup label="Use" options={options.uses} value={filters.use} onToggle={value => update({ ...filters, use: filters.use === value ? '' : value })} />
            <FilterGroup label="Weight" options={options.weights} value={filters.weight} onToggle={value => update({ ...filters, weight: filters.weight === value ? '' : value })} />
            <FilterGroup label="Colour" options={options.colours} value={filters.colour} colour onToggle={value => update({ ...filters, colour: filters.colour === value ? '' : value })} />
          </div>

          <div className="fabric-results">
            <div className="fabric-active-bar">
              {active.length === 0
                ? <span>Showing all {fabricProducts.length} {fabricProducts.length === 1 ? 'cloth' : 'cloths'}</span>
                : active.map(item => (
                  <button key={item.key} type="button" className="fabric-active-chip" onClick={() => update({ ...filters, [item.key]: '' })}>
                    {item.label}<span aria-hidden="true">×</span>
                  </button>
                ))}
              {active.length > 0 && <button type="button" className="fabric-clear" onClick={clear}>Clear all</button>}
            </div>

            <div className="fabric-results-head">
              <h2 id="fabric-library-title">{filtered.length} {filtered.length === 1 ? 'cloth' : 'cloths'}</h2>
              <p>{active.length > 0 ? `${active.length} filter${active.length === 1 ? '' : 's'} applied` : 'No filters applied'}</p>
            </div>

            {filtered.length === 0 ? (
              <div className="fabric-empty">
                <p>No cloth matches this combination.</p>
                <button type="button" className="osr-btn osr-btn--outline" onClick={clear}>Clear the filters</button>
              </div>
            ) : (
              <div className="fabric-grid">
                {filtered.map(product => (
                  <Link key={product.slug} className="fabric-card" href={productHref(product.slug)}>
                    <div className="fabric-card-media">
                      <FabricMedia src={product.fabric.image || product.images?.[0]} alt={product.name} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" />
                      <span className="osr-badge osr-badge--ink">Sold by the metre</span>
                    </div>
                    <div className="fabric-card-body">
                      <h3>{product.name}</h3>
                      <div className="fabric-card-specs">
                        <span>{product.fabric.type}</span>
                        {product.fabric.weight && <span>{product.fabric.weight}</span>}
                        {product.fabric.width && <span>{product.fabric.width} wide</span>}
                      </div>
                      {product.fabric.uses.length > 0 && (
                        <p>Good for {product.fabric.uses.slice(0, 3).join(' · ')}{product.fabric.uses.length > 3 ? ` +${product.fabric.uses.length - 3}` : ''}</p>
                      )}
                      <div className="fabric-card-price">
                        <strong>{product.fabric.priceFrom > 0 ? formatGBP(product.fabric.priceFrom) : '—'}</strong>
                        <span>per metre</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <p className="osr-note fabric-library-note">
              All fabric is sold in whole metres and cut in one continuous length up to the maximum shown on each cloth.
            </p>
          </div>
      </section>
    </div>
  )
}

function FilterGroup({ label, options, value, colour = false, onToggle }) {
  if (options.length === 0) return null
  return (
    <div className="fabric-filter-group">
      <p>{label}</p>
      <div className="fabric-filter-options">
        {options.map(option => (
          <button key={option.id} type="button" className={`fabric-chip ${colour ? 'fabric-chip--colour' : ''}`}
            aria-pressed={value === option.id} onClick={() => onToggle(option.id)}>
            {colour && <i aria-hidden="true" style={{ background: option.hex }} />}
            {option.label}{typeof option.count === 'number' ? <small>{option.count}</small> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
