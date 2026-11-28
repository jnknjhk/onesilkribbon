'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatGBP, FREE_SHIPPING_THRESHOLD } from '@/lib/pricing'
import { subscribeEmail, isValidEmail } from '@osr/core/lib/client/subscribe'
import { COLLECTIONS } from '@/lib/collections'
import GalleryHero from '@/components/home/GalleryHero'
import Reveal from '@/components/home/Reveal'

const COLLECTION_LABEL = Object.fromEntries(
  COLLECTIONS.map(collection => [collection.slug, collection.shortName || collection.name])
)

function ProductImage({ src, alt, sizes, className = '' }) {
  if (!src) return <div className={className} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#E8DDD0,#C4A882)' }} />
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} style={{ objectFit: 'cover' }} />
}

export default function HomeClient({ doors = [], ribbonHouses = [], ribbonCabinet = [], studioTools = [], storyImage, journalPosts = [], freeThreshold = FREE_SHIPPING_THRESHOLD, freeEnabled = true }) {
  return (
    <div className="osr-home">
      <GalleryHero freeThreshold={freeThreshold} freeEnabled={freeEnabled} />

      <div className="osr-welcome-invite">
        <p>10% off your first order</p>
        <button type="button" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event('osr:welcome-open'))}>
          View welcome offer
        </button>
      </div>

      <section className="osr-doors" id="rooms">
        <div className="osr-container">
          <Reveal className="osr-doors-head">
            <div>
              <span className="osr-eyebrow">The gallery rooms</span>
              <h2 className="osr-title osr-title--sm" style={{ marginTop: 16 }}>Three ways to begin.</h2>
            </div>
            <p>Start with ribbon, with a hand-finished adornment, or with the tools that hold the work steady. Every room returns to the same studio.</p>
          </Reveal>

          <div className="osr-doors-grid">
            {doors.map((door, index) => (
              <Reveal key={door.number} className="osr-door" delay={index * 90}>
                <Link href={door.href} className="osr-door-media" aria-label={`${door.title} — ${door.cta}`}>
                  <ProductImage src={door.image} alt={door.alt} sizes="(max-width: 960px) 100vw, 33vw" />
                  <span className="osr-badge osr-badge--ink">{door.badge}</span>
                  <span className="osr-door-num">{door.number}</span>
                </Link>
                <div className="osr-door-body">
                  <span className="osr-label">Room {door.number}</span>
                  <h2><Link href={door.href}>{door.title}</Link></h2>
                  <p>{door.copy}</p>
                  {door.links?.length > 0 && (
                    <div className="osr-door-links">
                      {door.links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
                    </div>
                  )}
                  <Link className="osr-textlink" href={door.href}>{door.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {ribbonHouses.length > 0 && (
        <section className="osr-houses" id="ribbons">
          <div className="osr-container">
            <Reveal className="osr-houses-head">
              <div>
                <span className="osr-eyebrow">Silk Ribbons</span>
                <h2 className="osr-title osr-title--sm" style={{ marginTop: 14 }}>Three ribbon <em>houses.</em></h2>
              </div>
              <p>Ultra-fine embroidery ribbon, hand-torn crêpe satin and a vintage crinkle. Different hands, different edges, the same mulberry silk.</p>
            </Reveal>

            <div className="osr-houses-grid">
              {ribbonHouses.map((house, index) => (
                <Reveal key={house.slug} className="osr-house-card" delay={index * 80}>
                  <Link href={house.href} className="osr-house-media" aria-label={house.label}>
                    <ProductImage src={house.image} alt={house.label} sizes="(max-width: 960px) 100vw, 33vw" />
                  </Link>
                  <div className="osr-house-body">
                    <h3><Link href={house.href}>{house.label}</Link></h3>
                    <p>{house.blurb}</p>
                    <div className="osr-house-meta">
                      {house.slug === 'vintage-inspired-ribbons' ? (
                        <>
                          <span>{house.count} ribbon</span>
                          <span>{house.skuCount} colourways</span>
                        </>
                      ) : (
                        <>
                          <span>{house.count} colourways</span>
                          <span>{house.note}</span>
                        </>
                      )}
                      {house.minPrice > 0 && <span>From {formatGBP(house.minPrice)}</span>}
                    </div>
                    <Link className="osr-textlink" href={house.href}>Browse {house.label}</Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {ribbonCabinet.length > 0 && (
        <section className="osr-cabinet">
          <div className="osr-container">
            <Reveal className="osr-cabinet-head">
              <div>
                <span className="osr-eyebrow">From the ribbon cabinet</span>
                <h2 className="osr-title osr-title--sm" style={{ marginTop: 14 }}>A few ends to begin with.</h2>
              </div>
              <Link className="osr-textlink" href="/collections#ribbons">See all ribbons</Link>
            </Reveal>

            <div className="osr-strip">
              {ribbonCabinet.map((product, index) => (
                <Reveal key={product.slug} delay={index * 70}>
                  <Link className="osr-mini-card" href={`/collections/${product.collection}/${product.slug}`}>
                    <div className="osr-mini-card-media">
                      <ProductImage src={product.image} alt={product.name} sizes="(max-width: 960px) 50vw, 25vw" />
                    </div>
                    <h3>{product.name}</h3>
                    <p>
                      {COLLECTION_LABEL[product.collection] || 'Silk ribbon'}
                      {product.minPrice > 0 ? ` · from ${formatGBP(product.minPrice)}` : ''}
                    </p>
                    {product.hexes.length > 0 && (
                      <div className="osr-swatch-dots" aria-hidden="true">
                        {product.hexes.map(hex => <span key={hex} className="osr-swatch-dot" style={{ background: hex }} />)}
                      </div>
                    )}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {studioTools.length > 0 && (
        <section className="osr-tools-feature">
          <div className="osr-container">
            <Reveal className="osr-tools-feature-grid">
              <div className="osr-tools-feature-media">
                <ProductImage
                  src={(studioTools.find(tool => tool.slug === 'adjustable-beechwood-embroidery-stand') || studioTools[0]).image}
                  alt="Adjustable beechwood tabletop embroidery stand holding a hoop of silk ribbon flowers"
                  sizes="(max-width: 960px) 100vw, 45vw"
                />
              </div>
              <div className="osr-tools-feature-body">
                <span className="osr-eyebrow">Studio Tools</span>
                <h2>The workbench, kept in the <em>exhibition.</em></h2>
                <p className="osr-lede">
                  Wooden spools, beechwood hoops and a tabletop stand with a butterfly clamp. These are the pieces that hold the ribbon steady while it becomes something else.
                </p>
                <div className="osr-tools-links">
                  {studioTools.map(tool => (
                    <Link key={tool.slug} href={`/collections/${tool.collection}/${tool.slug}`}>
                      {tool.name}
                      <span>{tool.minPrice > 0 ? `from ${formatGBP(tool.minPrice)}` : ''}</span>
                    </Link>
                  ))}
                </div>
                <Link className="osr-textlink" href="/collections/studio-tools">See the studio tools</Link>
                <Link className="osr-tools-cross" href="/collections/fine-silk-ribbons">Also used with the fine embroidery ribbon →</Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="osr-story">
        <div className="osr-story-grid">
          <div className="osr-story-media">
            <ProductImage src={storyImage} alt="One Silk Ribbon studio still life with hand-frayed silk ribbon" sizes="(max-width: 960px) 100vw, 50vw" />
          </div>
          <Reveal className="osr-story-body">
            <span className="osr-eyebrow">Our story</span>
            <h2>Made by hand. <em>Made with intention.</em></h2>
            <p>
              One Silk Ribbon began with a simple frustration: the impossibility of finding a ribbon that felt truly beautiful. We started with a single bolt of Grade 6A mulberry silk and a pair of hands.
            </p>
            <p>
              Today our collections bring together silk ribbons and handcrafted details, with colour, texture and care at the heart of each piece.
            </p>
            <Link className="osr-textlink osr-textlink--light" href="/about">Read our story</Link>
          </Reveal>
        </div>
      </section>

      <SilkNotes />

      <JournalSection posts={journalPosts} />

      <NewsletterSection />

      <style dangerouslySetInnerHTML={{ __html: `
        .osr-welcome-invite { display: none; }
        @media (max-width: 900px) {
          .osr-welcome-invite {
            display: flex; justify-content: space-between; align-items: center;
            flex-wrap: wrap; gap: 4px 16px;
            padding: 10px 20px;
            background: var(--osr-paper-2);
            border-bottom: 1px solid var(--osr-line);
          }
          .osr-welcome-invite p { font-size: 13px; color: var(--osr-ink); }
          .osr-welcome-invite button {
            min-height: 44px; border: 0; background: none;
            color: var(--osr-berry); font-size: 12px;
            text-decoration: underline; text-underline-offset: 4px;
          }
        }
      ` }} />
    </div>
  )
}

function SilkNotes() {
  return (
    <section className="osr-notes">
      <div className="osr-container">
        <Reveal className="osr-notes-inner">
          <span className="osr-eyebrow">About our silk</span>
          <h2 className="osr-title osr-title--sm" style={{ marginTop: 16 }}>
            How to choose <em>mulberry silk ribbon</em>
          </h2>

          <div className="osr-notes-cols">
            <div>
              <p>
                Choose by width and finish. Our fine mulberry silk ribbon comes on 10-metre spools in widths from 2mm to 13mm. Try the narrowest width for small bows, miniature clothing or stitched details, and a wider ribbon where you want the colour to stand out.
              </p>
              <p>
                Compare colours alongside the paper, flowers or fabric in your project. Product photographs are a useful starting point, but lighting and screen settings can change the way a shade appears. Check the selected option before ordering.
              </p>
            </div>
            <div>
              <p>
                Choose hand-frayed silk ribbon for a soft edge and loose tails on a bouquet. For textured bows on invitations or gifts, try the 10mm crinkle silk ribbon on a wooden spool. Check the product page for available colours and lengths.
              </p>
              <p>
                Unsure which to choose? Our <Link href="/ribbon-guide">ribbon selection guide</Link> explains how to compare widths and measure a sample for your project. For washing, handling and storage, see the <Link href="/care-guide">silk care guide</Link>.
              </p>
            </div>
          </div>

          <ul className="osr-notes-links">
            <li><Link href="/collections/fine-silk-ribbons">Fine silk ribbon, 2mm–13mm</Link></li>
            <li><Link href="/collections/hand-frayed-silk-ribbons">Hand-frayed silk ribbon</Link></li>
            <li><Link href="/collections/vintage-inspired-ribbons">Vintage-inspired ribbon</Link></li>
            <li><Link href="/collections/handcrafted-adornments">Handcrafted adornments</Link></li>
            <li><Link href="/collections/studio-tools">Studio tools</Link></li>
            <li><Link href="/bespoke">Bespoke &amp; wholesale</Link></li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

function JournalSection({ posts }) {
  if (!posts || posts.length === 0) return null

  const fallbackBackgrounds = [
    'linear-gradient(135deg, #E8DDD0, #C4A882)',
    'linear-gradient(135deg, #D4C5B0, #9A8878)',
    'linear-gradient(135deg, #E8C9B8, #9A7A66)',
  ]

  const formatDate = iso => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  return (
    <section className="osr-journal">
      <div className="osr-container">
        <Reveal className="osr-journal-head">
          <span className="osr-eyebrow">The Journal</span>
          <h2 className="osr-title osr-title--sm" style={{ marginTop: 16 }}>Stories from the <em>atelier.</em></h2>
        </Reveal>

        <div className="osr-journal-grid">
          {posts.map(post => (
            <Reveal key={post.slug}>
              <Link href={`/journal/${post.slug}`} className="osr-journal-card">
                <div className="osr-journal-media">
                  {post.cover_image ? (
                    <Image src={post.cover_image} alt={post.title} fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: fallbackBackgrounds[posts.indexOf(post) % 3] }} />
                  )}
                </div>
                <div className="osr-journal-body">
                  <div className="osr-journal-meta">
                    <span>{post.category}</span>
                    <span>{formatDate(post.published_at)}</span>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <span className="osr-journal-link">Read more →</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="osr-journal-more">
          <Link href="/journal" className="osr-textlink">View all articles</Link>
        </div>
      </div>
    </section>
  )
}

function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [msg, setMsg] = useState('')

  const handleSubscribe = async () => {
    if (!isValidEmail(email)) {
      setMsg('Please enter a valid email')
      setStatus('error')
      return
    }
    setStatus('loading')
    const result = await subscribeEmail(email, 'home_newsletter')
    if (result.ok) {
      setStatus('success')
      setMsg(result.already ? "You're already subscribed — thank you!" : 'Thank you! Please check your inbox to confirm.')
      setEmail('')
    } else {
      setStatus('error')
      setMsg(result.error)
    }
  }

  return (
    <section className="osr-newsletter">
      <div className="osr-container">
        <Reveal className="osr-newsletter-inner">
          <h2>Join the Atelier</h2>
          <p>Receive seasonal palette updates and artisan stories.</p>
          {status === 'success' ? (
            <p style={{ color: '#d7b7a2', fontSize: 13 }}>{msg}</p>
          ) : (
            <>
              <div className="osr-newsletter-form">
                <input
                  aria-label="Email address for newsletter"
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={event => { setEmail(event.target.value); setStatus(''); setMsg('') }}
                  onKeyDown={event => event.key === 'Enter' && handleSubscribe()}
                  placeholder="Email address"
                />
                <button type="button" onClick={handleSubscribe} disabled={status === 'loading'}>
                  {status === 'loading' ? '…' : 'Subscribe'}
                </button>
              </div>
              {status === 'error' && <p className="osr-newsletter-error" role="alert">{msg}</p>}
            </>
          )}
        </Reveal>
      </div>
    </section>
  )
}
