'use client'
import { COLLECTIONS, COLLECTION_BG } from '@/config/site'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatGBP } from '@/lib/pricing'
import { subscribeEmail, isValidEmail } from '@osr/core/lib/client/subscribe'

const COLLECTION_FALLBACK_BG = COLLECTION_BG

export default function HomeClient({ heroImages, storyImage, collectionImages, featuredProducts, freeThreshold = '45', freeEnabled = true }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('.reveal')
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
      }, { threshold: 0.08 })
      els.forEach(el => obs.observe(el))
      return () => obs.disconnect()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <Hero heroImages={heroImages} />
      <Marquee freeThreshold={freeThreshold} freeEnabled={freeEnabled} />
      <Collections collectionImages={collectionImages} />
      <StorySection storyImage={storyImage} />
      <FeaturedProducts products={featuredProducts} />
      <NewsletterSection />
      <style dangerouslySetInnerHTML={{ __html: `
        .reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.9s ease, transform 0.9s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .prod-card:hover .prod-img-inner { transform: scale(1.04); }
      ` }} />
    </>
  )
}

/* ═══ HERO ═══ */
function Hero({ heroImages }) {
  const [loaded, setLoaded] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (heroImages.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % heroImages.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [heroImages])

  return (
    <section className="hero">
      {/* 白盒画廊排版：文字居中在上，横版海报居中在下。
          不再用满屏深色背景图 + 白字，因为深色罩会把玻璃的通透压没。 */}
      <div className="hero-copy">
        <p className={`hero-anim ${loaded ? 'hero-in' : ''}`}
           style={{ transitionDelay: '0.1s', fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 28 }}>
          Hand-Blown Glass · Made in Britain
        </p>
        <h1 className="hero-title">
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.3s', display: 'block' }}>Light, held</span>
          <span className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '0.55s', display: 'block', fontStyle: 'italic', color: 'var(--accent-deep)' }}>in solid form</span>
        </h1>
        <p className={`hero-anim ${loaded ? 'hero-in' : ''}`}
           style={{ transitionDelay: '0.85s', fontSize: 16, lineHeight: 1.75, color: 'var(--ink-soft)', maxWidth: 480, margin: '0 auto 40px', textAlign: 'center', fontFamily: 'var(--font-serif-alt)' }}>
          Each piece is shaped by breath and gravity — no two alike, all made to be picked up, poured from, and lived with.
        </p>
        <div className={`hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.1s' }}>
          <Link href="/collections"><button className="hero-btn"><span className="hero-btn-line" />Explore Collections<span className="hero-btn-line" /></button></Link>
        </div>
      </div>

      {/* 横版海报。用 16:9 的画框把商品图裱起来，细边框 + 柔和投影，
          让它看起来像挂在白墙上的一幅作品，而不是网页背景。 */}
      <div className={`hero-stage hero-anim ${loaded ? 'hero-in' : ''}`} style={{ transitionDelay: '1.35s' }}>
        <div className="hero-frame">
          {heroImages.length > 0 ? (
            heroImages.map((src, i) => (
              <div key={src} className={`hero-slide ${i === currentIndex ? 'hero-slide-active' : ''}`}>
                <Image
                  src={src} alt="" fill
                  style={{ objectFit: 'cover' }}
                  {...(i === 0
                    ? { priority: true, fetchPriority: 'high' }   /* 第1张影响 LCP，优先加载 */
                    : { loading: 'lazy' })}
                  sizes="(max-width: 1240px) 100vw, 1200px"
                />
              </div>
            ))
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg,#F8FAFC,#E2E8F0 45%,#CBD5E1)' }} />
          )}
          {/* 玻璃面反光：一道极淡的斜向高光压在画框上 */}
          <div className="hero-sheen" />
        </div>

        {heroImages.length > 1 && (
          <div className="hero-dots">
            {heroImages.map((src, i) => (
              <span key={src} className={`hero-dot ${i === currentIndex ? 'hero-dot-on' : ''}`} />
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hero { position: relative; background: var(--paper); padding: 140px var(--page-padding) var(--section-padding-y); display: flex; flex-direction: column; align-items: center; }
        .hero-copy { position: relative; z-index: 2; text-align: center; max-width: 760px; display: flex; flex-direction: column; align-items: center; }
        .hero-title { font-family: var(--font-display); font-size: clamp(44px, 7vw, 88px); font-weight: 300; line-height: 1.05; color: var(--ink); margin-bottom: 32px; letter-spacing: -0.01em; }
        .hero-stage { width: 100%; max-width: 1200px; margin-top: 64px; }
        .hero-frame { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-sm); box-shadow: var(--shadow-card); background: var(--paper-sunk); }
        .hero-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1.5s ease-in-out; }
        .hero-slide-active { opacity: 1; animation: kenBurns 18s ease-out forwards; }
        @keyframes kenBurns { 0% { transform: scale(1.06); } 100% { transform: scale(1); } }
        .hero-sheen { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.14) 100%); }
        .hero-dots { display: flex; gap: 8px; justify-content: center; margin-top: 20px; }
        .hero-dot { width: 18px; height: 1px; background: var(--line-strong); transition: background 0.4s ease; }
        .hero-dot-on { background: var(--accent); }
        .hero-anim { opacity: 0; transform: translateY(24px); transition: opacity 0.9s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94); }
        .hero-in { opacity: 1 !important; transform: translateY(0) !important; }
        .hero-btn { background: none; border: 1px solid var(--line-strong); color: var(--ink); font-family: var(--font-body); font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; padding: 18px 48px; display: inline-flex; align-items: center; gap: 20px; cursor: pointer; transition: border-color 0.4s ease, color 0.4s ease; }
        .hero-btn:hover { border-color: var(--accent); color: var(--accent-deep); }
        .hero-btn-line { display: block; width: 28px; height: 1px; background: var(--accent); transition: width 0.4s ease; }
        .hero-btn:hover .hero-btn-line { width: 40px; }
        @media (max-width: 768px) {
          .hero { padding-top: 104px; }
          .hero-stage { margin-top: 44px; }
          .hero-frame { aspect-ratio: 4 / 3; }
          .hero-btn { padding: 16px 32px; font-size: 9px; }
        }
      ` }} />
    </section>
  )
}

function Marquee({ freeThreshold = '45', freeEnabled = true }) {
  const items = ['Fine Silk Ribbons','Hand-Frayed Collection','Handcrafted Adornments','Patterned Ribbons','Studio Tools','Vintage-Inspired','200+ Colourways', freeEnabled ? `Free Worldwide Shipping over £${freeThreshold}` : 'Worldwide Shipping Available']
  return (
    <div style={{ background: 'var(--deep)', padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'inline-flex', animation: 'marquee 24s linear infinite' }}>
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--warm)', padding: '0 40px' }}>{item} ·</span>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}` }} />
    </div>
  )
}

/* ═══ COLLECTIONS ═══ */
function Collections({ collectionImages }) {
  return (
    <section style={{ padding: 'var(--section-padding-y, 100px) 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 'clamp(48px, 6vw, 80px)', padding: '0 var(--page-padding, 60px)' }} className="reveal">
        <span className="eyebrow">Our Collections</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 300, marginTop: 20 }}>
          Six expressions of <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>pure silk</em>
        </h2>
      </div>

      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 var(--page-padding, 60px)' }}>
        {COLLECTIONS.map((c, i) => {
          const img = collectionImages[c.slug]
          const fallback = COLLECTION_FALLBACK_BG[c.slug]
          const isEven = i % 2 === 1

          return (
            <Link key={c.slug} href={`/collections/${c.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div className={`reveal col-row ${isEven ? 'col-row-reverse' : ''}`}>
                <div className="col-row-img" style={{ background: fallback }}>
                  {img && (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <Image
                        src={img} alt={c.name} fill
                        style={{ objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)' }}
                        className="col-row-img-inner"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, 40vw"
                      />
                    </div>
                  )}
                </div>
                <div className="col-row-text">
                  <span style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16, display: 'block' }}>{c.count}</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 3.5vw, 42px)', fontWeight: 300, color: 'var(--ink)', marginBottom: 20, lineHeight: 1.2 }}>{c.name}</h3>
                  <p style={{ fontSize: 15, color: 'var(--taupe)', lineHeight: 2, marginBottom: 28 }}>{c.desc}</p>
                  <span className="col-row-cta"><span className="col-row-cta-line" />Shop Collection</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .col-row { display: grid; grid-template-columns: 2fr 3fr; gap: 0; margin-bottom: clamp(16px, 3vw, 32px); overflow: hidden; min-height: 220px; }
        .col-row-reverse { direction: rtl; }
        .col-row-reverse > * { direction: ltr; }
        .col-row-img { overflow: hidden; position: relative; min-height: 200px; }
        .col-row:hover .col-row-img-inner { transform: scale(1.05) !important; }
        .col-row-text { display: flex; flex-direction: column; justify-content: center; padding: clamp(32px, 5vw, 72px); }
        .col-row-cta { display: inline-flex; align-items: center; gap: 14px; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--deep); }
        .col-row-cta-line { width: 28px; height: 1px; background: var(--gold); display: inline-block; transition: width 0.4s ease; }
        .col-row:hover .col-row-cta-line { width: 48px; }
        .col-row:hover .col-row-cta { color: var(--gold); }
        @media (max-width: 768px) { .col-row { grid-template-columns: 1fr; min-height: auto; } .col-row-reverse { direction: ltr; } .col-row-img { min-height: 180px; } .col-row-text { padding: 28px 24px 36px; } }
      ` }} />
    </section>
  )
}

/* ═══ STORY ═══ */
function StorySection({ storyImage }) {
  return (
    <section style={{ background: 'var(--sand)', overflow: 'hidden' }}>
      <div className="story-row reveal">
        <div className="story-img">
          {storyImage ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <Image src={storyImage} alt="Our Story" fill style={{ objectFit: 'cover' }} loading="lazy" sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #D4C5B0, #9A8878, #C4A882)' }} />
          )}
        </div>
        <div className="story-text">
          <span className="eyebrow" style={{ marginBottom: 20 }}>Our Story</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300, marginBottom: 28, lineHeight: 1.2, color: 'var(--ink)' }}>
            Made by hand.<br /><em style={{ fontStyle: 'italic' }}>Made with intention.</em>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 2, marginBottom: 20 }}>
            One Glass Object began with a simple frustration: the impossibility of finding a ribbon that felt truly beautiful. We started with a single bolt of Grade 6A mulberry silk and a pair of hands.
          </p>
          <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 2, marginBottom: 40 }}>
            Today we offer over 200 colourways across six collections — all made with the same quiet care as that very first yard.
          </p>
          <Link href="/about" className="btn-text"><span className="line" />Read Our Story</Link>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .story-row { display: grid; grid-template-columns: 1fr 1fr; max-width: 1360px; margin: 0 auto; min-height: 560px; }
        .story-img { overflow: hidden; }
        .story-text { display: flex; flex-direction: column; justify-content: center; padding: clamp(40px, 6vw, 80px); }
        @media (max-width: 768px) { .story-row { grid-template-columns: 1fr; } .story-img { min-height: 300px; } .story-text { padding: 40px 24px 60px; } }
      ` }} />
    </section>
  )
}

/* ═══ FEATURED PRODUCTS ═══ */
function FeaturedProducts({ products }) {
  return (
    <section className="featured-section">
      <div className="featured-header reveal">
        <div>
          <span className="eyebrow" style={{ marginBottom: 16 }}>Artisan Picks</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300 }}>
            Our <em style={{ fontStyle: 'italic', color: 'var(--taupe)' }}>Favourites</em>
          </h2>
        </div>
        <Link href="/collections" className="btn-text"><span className="line" />View All</Link>
      </div>
      <div className="featured-grid">
        {products.map(p => (
          <Link key={p.id} href={`/collections/${p.collection}/${p.slug}`} style={{ textDecoration: 'none' }} className="prod-card reveal">
            <div style={{ aspectRatio: '1/1', background: 'var(--sand)', marginBottom: 16, overflow: 'hidden', position: 'relative' }}>
              {p.images?.[0] && (
                <Image
                  src={p.images[0]} alt={p.name} fill
                  className="prod-img-inner"
                  style={{ objectFit: 'cover', transition: 'transform 0.8s ease' }}
                  loading="lazy"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              )}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 1.5vw, 18px)', color: 'var(--ink)' }}>{p.name}</h3>
            <p style={{ fontSize: 14, color: 'var(--taupe)', marginTop: 8 }}>From {formatGBP(p.price)}</p>
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {p.swatches.map((hex, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: hex, border: '1px solid rgba(0,0,0,0.05)' }} />
              ))}
            </div>
          </Link>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .featured-section { padding: var(--section-padding-y, 100px) var(--page-padding, 60px); background: var(--cream); }
        .featured-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 48px; flex-wrap: wrap; gap: 16px; }
        .featured-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .featured-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) { .featured-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; } .featured-header { margin-bottom: 32px; } }
      ` }} />
    </section>
  )
}

/* ═══ NEWSLETTER ═══ */
function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [msg, setMsg] = useState('')

  const handleSubscribe = async () => {
    if (!isValidEmail(email)) { setMsg('Please enter a valid email'); setStatus('error'); return }
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
    <section className="newsletter-section">
      <div className="newsletter-inner reveal">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 300, marginBottom: 20 }}>Join the Atelier</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 40, letterSpacing: '0.05em' }}>Receive seasonal palette updates and artisan stories.</p>
        {status === 'success' ? (
          <p style={{ fontSize: 13, color: 'var(--gold)', letterSpacing: '0.05em' }}>{msg}</p>
        ) : (
          <>
            <div className="newsletter-form">
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setStatus(''); setMsg('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                placeholder="Email Address" style={{ background: 'none', border: 'none', color: '#fff', flex: 1, outline: 'none', fontSize: 16, minWidth: 0 }} />
              <button onClick={handleSubscribe} disabled={status === 'loading'}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.2em', whiteSpace: 'nowrap', padding: '8px 0', cursor: 'pointer' }}>
                {status === 'loading' ? '…' : 'Subscribe'}
              </button>
            </div>
            {status === 'error' && <p style={{ fontSize: 11, color: '#f87171', marginTop: 8 }}>{msg}</p>}
          </>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .newsletter-section { padding: var(--section-padding-y, 100px) var(--page-padding, 60px); background: var(--deep); color: #fff; text-align: center; }
        .newsletter-inner { max-width: 500px; margin: 0 auto; }
        .newsletter-form { display: flex; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 12px; gap: 12px; }
        @media (max-width: 480px) { .newsletter-form { flex-direction: column; border-bottom: none; gap: 16px; } .newsletter-form input { border-bottom: 1px solid rgba(255,255,255,0.2) !important; padding-bottom: 12px; } .newsletter-form button { border: 1px solid rgba(255,255,255,0.2) !important; padding: 14px !important; } }
      ` }} />
    </section>
  )
}
