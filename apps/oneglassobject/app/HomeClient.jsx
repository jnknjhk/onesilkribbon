'use client'

/**
 * 首页 —— 画廊图录构图。
 *
 * 关键在于放弃"居中标题 + 卡片网格"那套电商模板节奏。全白配色下没有
 * 明暗对比可用，层次只能来自四件事：
 *
 *   1. 可见版心      12 栏网格，元素落在不同起止列上形成非对称
 *   2. 发丝线        章节分隔线带编号，像图录的页眉
 *   3. 字号级差      标题拉到极大，标签压到极小，中间档位一律不用
 *   4. 错位与留白    图文不对齐、故意留出大块空白
 *
 * 商品不用卡片网格，改成左右交替的编号索引——图录不会把展品排成方阵。
 *
 * 文案是中性占位，标了 TODO(文案)。
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { site, COLLECTIONS } from '@/config/site'

/* 滚动入场。
 *
 * ⚠️ 首要目标是"内容永远不会看不见"，动画是次要的。.reveal 初始 opacity: 0，
 * 任何让 is-in 加不上的路径都会让整段内容对用户永久消失。已处理两个坑：
 *   1. 元素被跳过去（锚点、返回时恢复滚动位置、Ctrl+End）——观察器只报"不相交"
 *   2. 观察器在某些环境根本不触发（不合成帧的无头浏览器、部分内嵌 WebView）
 * 后续页面要做入场动画，直接复用这个 hook，不要另写一份没有兜底的。
 */
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const show = () => el.classList.add('is-in')

    if (typeof IntersectionObserver === 'undefined') { show(); return }

    let io
    let everFired = false
    try {
      io = new IntersectionObserver(
        entries => {
          everFired = true
          for (const e of entries) {
            if (e.isIntersecting || e.boundingClientRect.top < 0) {
              e.target.classList.add('is-in')
              io.unobserve(e.target)
            }
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
      )
      io.observe(el)
    } catch { show(); return }

    const failsafe = setTimeout(() => { if (!everFired) show() }, 1000)
    return () => { clearTimeout(failsafe); io.disconnect() }
  }, [])
  return ref
}

const pad = n => String(n).padStart(2, '0')

function money(value, skuCount) {
  if (!value || value <= 0) return '—'
  const amount = `${site.currencySymbol}${Number(value).toFixed(2)}`
  // 只有真存在多个价位才写 From；一件孤品写"起价"显得含糊
  return skuCount > 1 ? `From ${amount}` : amount
}

/* 章节页眉：编号 + 标签 + 右侧注记。图录感的主要来源。 */
function IndexRule({ n, label, end }) {
  return (
    <div className="index-rule">
      <span className="num">{pad(n)}</span>
      <span className="index-rule-label">{label}</span>
      {end && <span className="index-rule-end">{end}</span>}
    </div>
  )
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
      <WorksIndex products={featuredProducts} />
      <CollectionsIndex images={collectionImages} />
      <Studio image={storyImage} />
      <Commissions freeThreshold={freeThreshold} freeEnabled={freeEnabled} />
    </>
  )
}

/* ═══ 01 HERO ═══
   标题左置并缩进，图片右置且上提，两者在垂直方向错开。
   不居中、不对称——这是整页调子的定调处。 */
function Hero({ images }) {
  const [loaded, setLoaded] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
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
      <div className="container">
        <div className={`reveal ${on}`}>
          <IndexRule n={1} label={site.name} end="MMXXVI" />
        </div>

        <div className="grid12 hero-grid">
          <div className="hero-type">
            {/* TODO(文案)：确认工艺与产地后重写 */}
            <h1 className="type-xl hero-title">
              <span className={`reveal ${on}`} style={{ transitionDelay: '.1s' }}>Light,</span>
              <span className={`reveal hero-indent ${on}`} style={{ transitionDelay: '.25s' }}>held in</span>
              <span className={`reveal ${on}`} style={{ transitionDelay: '.4s' }}><em>solid form</em></span>
            </h1>
          </div>

          <div className={`hero-media reveal ${on}`} style={{ transitionDelay: '.55s' }}>
            <div className="hero-frame">
              {images.length > 0 ? (
                images.map((src, i) => (
                  <div key={src} className={`hero-slide ${i === index ? 'is-active' : ''}`}>
                    <Image
                      src={src} alt="" fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 899px) 100vw, 45vw"
                      {...(i === 0 ? { priority: true, fetchPriority: 'high' } : { loading: 'lazy' })}
                    />
                  </div>
                ))
              ) : (
                <div className="frame-empty" />
              )}
              <span className="frame-sheen" />
            </div>

            {images.length > 1 && (
              <div className="hero-dots">
                {images.map((src, i) => (
                  <button
                    key={src}
                    className={`hero-dot ${i === index ? 'is-on' : ''}`}
                    aria-label={`Show image ${i + 1}`}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className={`hero-aside reveal ${on}`} style={{ transitionDelay: '.7s' }}>
            <p className="lede">
              Objects shaped by breath and gravity — each one a little different
              from the last, made to be lived with rather than looked after.
            </p>
            <Link href="/collections" className="btn-text hero-link">
              <span className="line" />View the collection
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero { padding: 40px 0 var(--section-padding-y); }
        .hero-grid { align-items: start; }

        .hero-type { grid-column: 1 / 9; }
        .hero-title span { display: block; }
        /* 第二行缩进——一行错开，整块字就不再是规整的方块 */
        .hero-indent { padding-left: 0.9em; }

        /* 图片上提，咬进标题右侧的留白里 */
        .hero-media { grid-column: 9 / 13; margin-top: -18px; }
        .hero-frame {
          position: relative; aspect-ratio: 3 / 4; overflow: hidden;
          border: 1px solid var(--line); background: var(--paper-sunk);
        }
        .hero-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1.4s ease-in-out; }
        .hero-slide.is-active { opacity: 1; animation: kenBurns 20s ease-out forwards; }
        @keyframes kenBurns { from { transform: scale(1.06); } to { transform: scale(1); } }

        .hero-dots { display: flex; gap: 6px; margin-top: 12px; }
        .hero-dot { width: 16px; height: 10px; padding: 0; background: none; border: none; position: relative; }
        .hero-dot::after {
          content: ''; position: absolute; left: 0; top: 50%;
          width: 16px; height: 1px; background: var(--line-strong);
          transition: background var(--transition);
        }
        .hero-dot.is-on::after { background: var(--accent); }

        /* 副文案落在左下，与标题错开一大段留白 */
        .hero-aside { grid-column: 3 / 7; margin-top: 48px; }
        .hero-link { margin-top: 26px; }

        @media (max-width: 899px) {
          .hero { padding-top: 28px; }
          .hero-indent { padding-left: 0; }
          .hero-media { margin-top: 8px; }
          .hero-frame { aspect-ratio: 4 / 5; }
          .hero-aside { margin-top: 8px; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 02 精选作品 ═══
   左右交替的编号索引，不是卡片方阵。每件配博物馆式展签。 */
function WorksIndex({ products }) {
  const ref = useReveal()
  if (!products || products.length === 0) return null

  return (
    <section className="section works reveal" ref={ref}>
      <div className="container">
        <IndexRule n={2} label="Selected works" end={`${pad(products.length)} pieces`} />

        <ol className="works-list">
          {products.map((p, i) => (
            <li key={p.id} className={`work ${i % 2 ? 'work--flip' : ''}`}>
              <Link href={`/collections/${p.collection}/${p.slug}`} className="work-link grid12">
                <span className="num work-num">{pad(i + 1)}</span>

                <div className="work-media">
                  <div className="work-frame">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} fill sizes="(max-width: 899px) 100vw, 40vw" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className="frame-empty" />
                    )}
                    <span className="frame-sheen work-sheen" />
                  </div>
                </div>

                <div className="work-meta">
                  <h3 className="work-name">{p.name}</h3>
                  {/* TODO(文案)：材质、尺寸、工艺等真实参数要从 products.specifications 读，
                      现在数据库里还没有商品，先只显示已有字段 */}
                  <dl className="spec">
                    <div className="spec-row">
                      <dt className="spec-key">Collection</dt>
                      <dd className="spec-val">{p.collection}</dd>
                    </div>
                    <div className="spec-row">
                      <dt className="spec-key">Price</dt>
                      <dd className="spec-val">{money(p.price, p.skuCount)}</dd>
                    </div>
                  </dl>
                  <span className="work-cta">View piece →</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <style jsx>{`
        .works-list { list-style: none; margin: 0; padding: 0; }
        .work + .work { margin-top: 88px; }
        .work-link { align-items: center; }

        .work-num { grid-column: 1 / 2; align-self: start; padding-top: 4px; }
        .work-media { grid-column: 2 / 8; }
        .work-meta { grid-column: 9 / 13; }

        /* 偶数项左右对调，形成之字形节奏 */
        .work--flip .work-media { grid-column: 6 / 12; }
        .work--flip .work-meta  { grid-column: 2 / 6; }
        .work--flip .work-num   { grid-column: 12 / 13; text-align: right; }

        .work-frame {
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          border: 1px solid var(--line); background: var(--paper-sunk);
          transition: transform var(--transition);
        }
        .work-link:hover .work-frame { transform: translateY(-5px); }

        /* 悬停时一道窄高光斜掠过——光线扫过玻璃，而不是把图片压暗 */
        .work-sheen {
          background: linear-gradient(105deg,
            transparent 0%, rgba(255,255,255,.5) 45%, rgba(255,255,255,.8) 50%,
            rgba(255,255,255,.5) 55%, transparent 100%);
          left: -55%; right: auto; width: 55%;
          transform: translateX(0);
          mix-blend-mode: screen;
        }
        .work-link:hover .work-sheen {
          transform: translateX(330%);
          transition: transform .9s cubic-bezier(.22,.61,.36,1);
        }

        .work-name {
          font-family: var(--font-display); font-weight: 300;
          font-size: clamp(26px, 3vw, 38px); line-height: 1.1;
          margin-bottom: 20px;
          transition: color var(--transition);
        }
        .work-link:hover .work-name { color: var(--accent-deep); }

        .work-cta {
          display: inline-block; margin-top: 20px;
          font-size: 10px; letter-spacing: .24em; text-transform: uppercase;
          color: var(--accent);
        }

        @media (max-width: 899px) {
          .work + .work { margin-top: 56px; }
          .work-num { text-align: left !important; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 03 系列 ═══
   竖排编号索引，发丝线分行。悬停时行内缩进 + 缩略图淡入。
   比四张等大卡片更像图录目录。 */
function CollectionsIndex({ images }) {
  const ref = useReveal()

  return (
    <section className="section cols reveal" ref={ref}>
      <div className="container">
        <IndexRule n={3} label="Collections" end={`${pad(COLLECTIONS.length)} groups`} />

        <ol className="cols-list">
          {COLLECTIONS.map((c, i) => (
            <li key={c.slug} className="col-row">
              <Link href={`/collections/${c.slug}`} className="col-link grid12">
                <span className="num col-num">{pad(i + 1)}</span>

                <h3 className="col-name">{c.name}</h3>

                <p className="col-desc">{c.desc}</p>

                <div className="col-thumb">
                  {images[c.slug] ? (
                    <Image src={images[c.slug]} alt="" fill sizes="180px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="frame-empty" style={{ background: c.bg }} />
                  )}
                </div>

                <span className="col-eyebrow eyebrow">{c.count}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <style jsx>{`
        .cols-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
        .col-row { border-bottom: 1px solid var(--line); }
        .col-link {
          align-items: center;
          padding: 30px 0;
          transition: padding-left var(--transition);
        }
        .col-link:hover { padding-left: 12px; }

        .col-num { grid-column: 1 / 2; align-self: center; }
        .col-name {
          grid-column: 2 / 7;
          font-family: var(--font-display); font-weight: 300;
          font-size: clamp(28px, 3.4vw, 46px); line-height: 1.05;
          transition: color var(--transition);
        }
        .col-link:hover .col-name { color: var(--accent-deep); }

        .col-desc {
          grid-column: 7 / 11;
          font-size: 13px; line-height: 1.7; color: var(--ink-soft);
        }
        .col-eyebrow { grid-column: 11 / 12; align-self: center; }

        .col-thumb {
          grid-column: 12 / 13;
          position: relative; aspect-ratio: 1 / 1; overflow: hidden;
          border: 1px solid var(--line);
          opacity: 0; transition: opacity var(--transition);
        }
        .col-link:hover .col-thumb { opacity: 1; }

        @media (max-width: 899px) {
          .col-link { padding: 22px 0; row-gap: 12px; }
          .col-link:hover { padding-left: 0; }
          /* 窄屏塌成单栏后缩略图常显，否则手机上永远看不到图 */
          .col-thumb { opacity: 1; aspect-ratio: 16 / 9; }
          .col-name { font-size: 30px; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 04 工作室 ═══ */
function Studio({ image }) {
  const ref = useReveal()

  return (
    <section className="section studio reveal" ref={ref}>
      <div className="container">
        <IndexRule n={4} label="The studio" />

        <div className="grid12 studio-grid">
          <div className="studio-media">
            <div className="studio-frame">
              {image ? (
                <Image src={image} alt="" fill sizes="(max-width: 899px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="frame-empty" />
              )}
            </div>
          </div>

          <div className="studio-copy">
            {/* TODO(文案)：确认工艺（吹制/铸造）、是否自制、产地后整段重写 */}
            <p className="studio-quote">
              No two are the same, and that is the <em>whole point</em>.
            </p>
            <p className="lede studio-body">
              Every piece begins as molten glass and ends with its own slight
              asymmetries — a thickness that catches light on one side, a rim that
              is never quite perfectly round.
            </p>
            <p className="lede studio-body">
              Those marks are not flaws to be corrected. They are the record of how
              the object was made.
            </p>
            <Link href="/about" className="btn-text studio-link">
              <span className="line" />Read our story
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .studio-grid { align-items: start; }
        .studio-media { grid-column: 1 / 5; }
        .studio-frame {
          position: relative; aspect-ratio: 3 / 4; overflow: hidden;
          border: 1px solid var(--line); background: var(--paper-sunk);
        }
        /* 文字块下沉，和图片顶端错开 */
        .studio-copy { grid-column: 6 / 12; padding-top: 56px; }

        .studio-quote {
          font-family: var(--font-display); font-weight: 300;
          font-size: clamp(28px, 3.6vw, 48px); line-height: 1.15;
          letter-spacing: -0.015em; margin-bottom: 32px;
        }
        .studio-quote em { font-style: italic; color: var(--accent-deep); }
        .studio-body + .studio-body { margin-top: 16px; }
        .studio-link { margin-top: 30px; }

        @media (max-width: 899px) {
          .studio-copy { padding-top: 0; }
        }
      `}</style>
    </section>
  )
}

/* ═══ 05 定制 ═══ */
function Commissions({ freeThreshold, freeEnabled }) {
  const ref = useReveal()

  return (
    <section className="section comm reveal" ref={ref}>
      <div className="container">
        <IndexRule n={5} label="Commissions" />

        <div className="grid12">
          <div className="comm-copy">
            {/* TODO(文案)：确认是否接定制、范围与交期后重写 */}
            <h2 className="type-xl comm-title">
              Made for<br /><em>one place</em>
            </h2>
          </div>

          <div className="comm-aside">
            <p className="lede">
              Pieces can be made to a size, a colour, or a particular quality of
              light. Tell us the room and we will tell you what is possible.
            </p>
            <Link href="/bespoke" className="btn-secondary comm-btn">Enquire</Link>
            <p className="comm-note">
              {freeEnabled
                ? `Packed and insured. Free UK shipping over ${site.currencySymbol}${freeThreshold}.`
                : 'Packed and insured. Shipping calculated at checkout.'}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .comm-copy { grid-column: 1 / 8; }
        .comm-title { font-size: clamp(44px, 7vw, 104px); }
        .comm-aside { grid-column: 9 / 13; padding-top: 20px; }
        .comm-btn { width: auto; margin-top: 28px; }
        .comm-note {
          margin-top: 24px; font-size: 12px;
          letter-spacing: .03em; color: var(--ink-faint);
        }
      `}</style>
    </section>
  )
}
