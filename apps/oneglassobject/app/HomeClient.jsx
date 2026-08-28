'use client'

/**
 * 首页。
 *
 * 按玻璃摆件 / 艺术品的生意结构编排，不是丝带站那套：
 * 少而大的作品展示、留白、单件叙事，而不是密集商品网格 + 卖点跑马灯。
 *
 * 区块顺序：
 *   Hero（主视觉海报）→ 精选作品 → 系列入口 → 工作室 → 定制邀约
 *
 * 文案一律是中性占位，标了 TODO(文案)，等业主确认工艺/产地/价位后重写。
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { site, COLLECTIONS } from '@/config/site'

/* 滚动入场：元素进入视口后加 is-in，只触发一次。
 *
 * ⚠️ 这里的首要目标是"内容永远不会看不见"，动画是次要的。
 * .reveal 的初始状态是 opacity: 0，所以任何让 is-in 加不上的路径
 * 都会导致整段内容对用户永久消失。已知的两个坑：
 *
 *   1. 元素被"跳过去"——锚点跳转、浏览器返回时恢复滚动位置、Ctrl+End。
 *      观察器只报告"当前不相交"，元素已在视口上方，永远等不到进入。
 *      所以要额外判断 boundingClientRect.top < 0（已滚过）直接显示。
 *   2. IntersectionObserver 不可用或构造抛错。此时直接显示，不做动画。
 */
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const show = () => el.classList.add('is-in')

    if (typeof IntersectionObserver === 'undefined') {
      show()
      return
    }

    let io
    let everFired = false
    try {
      io = new IntersectionObserver(
        entries => {
          everFired = true
          for (const e of entries) {
            // 进入视口，或已经被滚过去了（在视口上方），都算数
            if (e.isIntersecting || e.boundingClientRect.top < 0) {
              e.target.classList.add('is-in')
              io.unobserve(e.target)
            }
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
      )
      io.observe(el)
    } catch {
      show()
      return
    }

    /* 兜底：正常浏览器里 observe() 之后一定会有一次初始回调（哪怕是"不相交"）。
       一次都没有，说明观察器在这个环境里不工作——比如页面不合成帧的无头浏览器、
       某些内嵌 WebView。这种情况下宁可不要动画，也不能让整段内容留在 opacity: 0。 */
    const failsafe = setTimeout(() => { if (!everFired) show() }, 1000)

    return () => {
      clearTimeout(failsafe)
      io.disconnect()
    }
  }, [])
  return ref
}

function price(value, skuCount) {
  if (!value || value <= 0) return ''
  const amount = `${site.currencySymbol}${Number(value).toFixed(2)}`
  // 只有真的有多个价位才写 From，否则一件孤品写 "From" 会显得含糊
  return skuCount > 1 ? `From ${amount}` : amount
}

export default function HomeClient({
  heroImages = [],
  storyImage = null,
  collectionImages = {},
  featuredProducts = [],
  freeThreshold = '45',
  freeEnabled = true,
}) {
  return (
    <>
      <Hero images={heroImages} />
      <FeaturedWorks products={featuredProducts} />
      <Collections images={collectionImages} />
      <Studio image={storyImage} />
      <Commissions freeThreshold={freeThreshold} freeEnabled={freeEnabled} />
    </>
  )
}

/* ═══ HERO ═══
   居中文案在上，横版海报在下。不用满屏深色底图压白字——
   深色罩会把玻璃的通透感抹掉，而通透正是这门生意要卖的东西。 */
function Hero({ images }) {
  const [loaded, setLoaded] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 120)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => setIndex(i => (i + 1) % images.length), 6000)
    return () => clearInterval(id)
  }, [images])

  const on = loaded ? 'is-in' : ''

  return (
    <section className="hero">
      <div className="hero-copy">
        {/* TODO(文案)：确认工艺与产地后重写 */}
        <p className={`reveal ${on}`} style={{ transitionDelay: '.05s' }}>
          <span className="eyebrow">Hand-blown glass · One at a time</span>
        </p>

        <h1 className="hero-title">
          <span className={`reveal ${on}`} style={{ transitionDelay: '.2s' }}>Light, held</span>
          <span className={`reveal ${on}`} style={{ transitionDelay: '.4s' }}><em>in solid form</em></span>
        </h1>

        <p className={`lede hero-lede reveal ${on}`} style={{ transitionDelay: '.6s' }}>
          Objects shaped by breath and gravity — each one a little different from the last,
          made to be lived with rather than looked after.
        </p>

        <div className={`reveal ${on}`} style={{ transitionDelay: '.8s' }}>
          <Link href="/collections" className="hero-cta">
            <span className="hero-cta-line" />
            View the collection
            <span className="hero-cta-line" />
          </Link>
        </div>
      </div>

      {/* 海报画框：细边 + 柔和投影，像挂在白墙上的作品，而不是网页背景 */}
      <div className={`hero-stage reveal ${on}`} style={{ transitionDelay: '1s' }}>
        <div className="hero-frame">
          {images.length > 0 ? (
            images.map((src, i) => (
              <div key={src} className={`hero-slide ${i === index ? 'is-active' : ''}`}>
                <Image
                  src={src}
                  alt=""
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 1280px) 100vw, 1200px"
                  {...(i === 0 ? { priority: true, fetchPriority: 'high' } : { loading: 'lazy' })}
                />
              </div>
            ))
          ) : (
            <div className="hero-empty" />
          )}
          <div className="hero-sheen" />
        </div>

        {images.length > 1 && (
          <div className="hero-dots" role="tablist" aria-label="Hero images">
            {images.map((src, i) => (
              <button
                key={src}
                className={`hero-dot ${i === index ? 'is-on' : ''}`}
                aria-label={`Show image ${i + 1}`}
                aria-selected={i === index}
                role="tab"
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .hero {
          display: flex; flex-direction: column; align-items: center;
          padding: 72px var(--page-padding) var(--section-padding-y);
          background: var(--paper);
        }
        .hero-copy { max-width: 760px; text-align: center; }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(44px, 7vw, 88px);
          font-weight: 300; line-height: 1.06;
          margin: 26px 0 28px;
        }
        .hero-title span { display: block; }
        .hero-title em { font-style: italic; color: var(--accent-deep); }
        .hero-lede { max-width: 480px; margin: 0 auto 40px; }

        .hero-cta {
          display: inline-flex; align-items: center; gap: 18px;
          padding: 17px 44px;
          border: 1px solid var(--line-strong);
          border-radius: var(--radius-sm);
          font-size: 10px; letter-spacing: .3em; text-transform: uppercase;
          color: var(--ink);
          transition: border-color var(--transition), color var(--transition);
        }
        .hero-cta:hover { border-color: var(--accent); color: var(--accent-deep); }
        .hero-cta-line {
          width: 26px; height: 1px; background: var(--accent);
          transition: width var(--transition);
        }
        .hero-cta:hover .hero-cta-line { width: 38px; }

        .hero-stage { width: 100%; max-width: 1200px; margin-top: 60px; }
        .hero-frame {
          position: relative; aspect-ratio: 16 / 9; overflow: hidden;
          border: 1px solid var(--line); border-radius: var(--radius-sm);
          box-shadow: var(--shadow-card); background: var(--paper-sunk);
        }
        .hero-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1.4s ease-in-out; }
        .hero-slide.is-active { opacity: 1; animation: kenBurns 18s ease-out forwards; }
        @keyframes kenBurns { from { transform: scale(1.06); } to { transform: scale(1); } }

        .hero-empty {
          position: absolute; inset: 0;
          background: linear-gradient(120deg, #F8FAFC, #E2E8F0 45%, #CBD5E1);
        }
        /* 玻璃面反光：极淡的斜向高光压在画框上 */
        .hero-sheen {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg,
            rgba(255,255,255,.26) 0%, rgba(255,255,255,0) 38%,
            rgba(255,255,255,0) 62%, rgba(255,255,255,.13) 100%);
        }

        .hero-dots { display: flex; gap: 8px; justify-content: center; margin-top: 20px; }
        .hero-dot {
          width: 20px; height: 10px; padding: 0;
          background: none; border: none; position: relative;
        }
        .hero-dot::after {
          content: ''; position: absolute; left: 0; top: 50%;
          width: 20px; height: 1px; background: var(--line-strong);
          transition: background var(--transition);
        }
        .hero-dot.is-on::after { background: var(--accent); }

        @media (min-width: 768px) { .hero { padding-top: 96px; } }
        @media (max-width: 767px) {
          .hero-stage { margin-top: 40px; }
          .hero-frame { aspect-ratio: 4 / 3; }
          .hero-cta { padding: 15px 30px; font-size: 9px; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 精选作品 ═══
   三件，大图，一行。玻璃件靠体量和留白说话，不适合密集网格。 */
function FeaturedWorks({ products }) {
  const ref = useReveal()
  if (!products || products.length === 0) return null

  return (
    <section className="section works reveal" ref={ref}>
      <div className="container">
        <header className="section-header">
          <span className="eyebrow">Selected works</span>
          <h2 className="display-title" style={{ marginTop: 14 }}>Currently in the studio</h2>
        </header>

        <div className="works-grid">
          {products.map(p => (
            <Link key={p.id} href={`/collections/${p.collection}/${p.slug}`} className="work">
              <div className="work-frame">
                {p.image ? (
                  <Image src={p.image} alt={p.name} fill sizes="(max-width: 767px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="work-empty" />
                )}
                <span className="work-sheen" />
              </div>
              <h3 className="work-name">{p.name}</h3>
              <p className="work-price">{price(p.price, p.skuCount)}</p>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .works-grid { display: grid; grid-template-columns: 1fr; gap: 44px; }

        .work-frame {
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          background: var(--paper-sunk);
          border: 1px solid var(--line); border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition), transform var(--transition);
        }
        .work:hover .work-frame { box-shadow: var(--shadow-lift); transform: translateY(-6px); }
        .work-empty {
          position: absolute; inset: 0;
          background: linear-gradient(160deg, #F1F5F9, #CBD5E1);
        }
        /* 悬停时一道窄高光斜掠过——光线扫过玻璃，而不是把图片压暗 */
        .work-sheen {
          position: absolute; top: 0; bottom: 0; width: 55%;
          background: linear-gradient(105deg,
            transparent 0%, rgba(255,255,255,.5) 45%, rgba(255,255,255,.8) 50%,
            rgba(255,255,255,.5) 55%, transparent 100%);
          transform: translateX(-130%);
          mix-blend-mode: screen; pointer-events: none;
        }
        .work:hover .work-sheen {
          transform: translateX(240%);
          transition: transform .9s cubic-bezier(.22,.61,.36,1);
        }

        .work-name {
          margin-top: 18px;
          font-family: var(--font-display);
          font-size: clamp(19px, 1.8vw, 23px); font-weight: 300;
          transition: color var(--transition);
        }
        .work:hover .work-name { color: var(--accent-deep); }
        .work-price { margin-top: 5px; font-size: 14px; color: var(--ink-soft); }

        @media (min-width: 768px) {
          .works-grid { grid-template-columns: repeat(3, 1fr); gap: 32px; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 系列入口 ═══ */
function Collections({ images }) {
  const ref = useReveal()

  return (
    <section className="section section--sunk cols reveal" ref={ref}>
      <div className="container">
        <header className="section-header">
          <span className="eyebrow">Collections</span>
          <h2 className="display-title" style={{ marginTop: 14 }}>
            {COLLECTIONS.length} ways into the material
          </h2>
        </header>

        <div className="cols-grid">
          {COLLECTIONS.map(c => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="col">
              <div className="col-frame">
                {images[c.slug] ? (
                  <Image src={images[c.slug]} alt={c.name} fill sizes="(max-width: 767px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="col-empty" style={{ background: c.bg }} />
                )}
              </div>
              <div className="col-meta">
                <span className="eyebrow">{c.count}</span>
                <h3 className="col-name">{c.name}</h3>
                <p className="col-desc">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .cols-grid { display: grid; grid-template-columns: 1fr; gap: 40px; }
        .col-frame {
          position: relative; aspect-ratio: 3 / 2; overflow: hidden;
          border: 1px solid var(--line); border-radius: var(--radius-sm);
          background: var(--paper);
          transition: box-shadow var(--transition);
        }
        .col:hover .col-frame { box-shadow: var(--shadow-card); }
        .col-empty { position: absolute; inset: 0; }
        .col-meta { padding-top: 18px; }
        .col-name {
          margin: 8px 0 8px;
          font-family: var(--font-display);
          font-size: clamp(22px, 2.2vw, 28px); font-weight: 300;
          transition: color var(--transition);
        }
        .col:hover .col-name { color: var(--accent-deep); }
        .col-desc { font-size: 14px; line-height: 1.7; color: var(--ink-soft); max-width: 44ch; }

        @media (min-width: 768px) {
          .cols-grid { grid-template-columns: repeat(2, 1fr); gap: 48px 40px; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 工作室 ═══ */
function Studio({ image }) {
  const ref = useReveal()

  return (
    <section className="section studio reveal" ref={ref}>
      <div className="container studio-grid">
        <div className="studio-media">
          {image ? (
            <Image src={image} alt="" fill sizes="(max-width: 899px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="studio-empty" />
          )}
        </div>

        <div className="studio-copy">
          <span className="eyebrow">The studio</span>
          <h2 className="display-title" style={{ marginTop: 14 }}>
            Made by hand.<br />Made one at a time.
          </h2>
          <div className="rule rule--left" />
          {/* TODO(文案)：等业主确认工艺（吹制/铸造）、是否自制、产地后整段重写 */}
          <p className="lede" style={{ marginTop: 26 }}>
            Every piece begins as molten glass and ends as something with its own
            slight asymmetries — a thickness that catches light on one side, a rim
            that is never quite perfectly round.
          </p>
          <p className="lede" style={{ marginTop: 16 }}>
            Those marks are not flaws to be corrected. They are the record of how
            the object was made, and the reason no two are the same.
          </p>
          <Link href="/about" className="btn-text studio-link">
            <span className="line" />Read our story
          </Link>
        </div>
      </div>

      <style jsx>{`
        .studio-grid { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
        .studio-media {
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          border: 1px solid var(--line); border-radius: var(--radius-sm);
          box-shadow: var(--shadow-card); background: var(--paper-sunk);
        }
        .studio-empty {
          position: absolute; inset: 0;
          background: linear-gradient(150deg, #F8FAFC, #E2E8F0 50%, #CBD5E1);
        }
        .studio-link { margin-top: 30px; }

        @media (min-width: 900px) {
          .studio-grid { grid-template-columns: 1fr 1fr; gap: 72px; }
          .studio-media { aspect-ratio: 4 / 5; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 定制邀约 ═══
   代替丝带站的跑马灯。运费信息放在这里安静地说一次就够，
   不需要滚动横幅反复喊。 */
function Commissions({ freeThreshold, freeEnabled }) {
  const ref = useReveal()

  return (
    <section className="section section--sunk comm reveal" ref={ref}>
      <div className="container container--text comm-inner">
        <span className="eyebrow">Commissions</span>
        <h2 className="display-title" style={{ marginTop: 14 }}>
          Something made for <em>one place</em>
        </h2>
        {/* TODO(文案)：等业主确认是否接定制、范围与交期后重写 */}
        <p className="lede" style={{ marginTop: 22 }}>
          Pieces can be made to a size, a colour, or a particular quality of light.
          Tell us the room and we will tell you what is possible.
        </p>
        <Link href="/bespoke" className="btn-secondary comm-btn">Enquire</Link>

        <p className="comm-note">
          {freeEnabled
            ? `Carefully packed and insured. Free UK shipping over ${site.currencySymbol}${freeThreshold}.`
            : 'Carefully packed and insured. Shipping calculated at checkout.'}
        </p>
      </div>

      <style jsx>{`
        .comm-inner { text-align: center; }
        .comm-btn { width: auto; margin-top: 32px; }
        .comm-note {
          margin-top: 28px;
          font-size: 12px; letter-spacing: .04em; color: var(--ink-faint);
        }
      `}</style>
    </section>
  )
}
