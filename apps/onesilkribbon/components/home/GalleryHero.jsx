'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { formatGBP } from '@/lib/pricing'

export default function GalleryHero({ freeThreshold = 45, freeEnabled = true }) {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const update = () => {
      frame = 0
      const rect = section.getBoundingClientRect()
      const travel = section.offsetHeight - window.innerHeight
      if (travel <= 0) return
      const progress = Math.min(1, Math.max(0, -rect.top / travel))
      section.style.setProperty('--p', progress.toFixed(4))
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section className="osr-hero" ref={sectionRef} aria-labelledby="osr-hero-title">
      <div className="osr-hero-sticky">
        <div className="osr-hero-frame">
          <picture>
            <source media="(max-width: 700px)" srcSet="/images/silk-gallery/hero-mobile.jpg" />
            <img
              className="osr-hero-media"
              src="/images/silk-gallery/hero-desktop.jpg"
              alt="Pearl White hand-frayed silk ribbon on a vintage wooden spool beside white lace and a ceramic rabbit"
              loading="eager"
              fetchPriority="high"
            />
          </picture>
          <div className="osr-hero-shade" />
          <div className="osr-hero-grain" />
        </div>

        <div className="osr-hero-copy">
          <p className="osr-hero-kicker">One Silk Ribbon · The studio collection</p>
          <h1 className="osr-hero-title" id="osr-hero-title">The quiet theatre of <em>silk.</em></h1>
          <p className="osr-hero-sub">
            Hand-torn ribbon, fine embroidery silk and the small tools of the atelier — photographed in the studio and made to be used slowly.
          </p>
          <div className="osr-hero-actions">
            <a className="osr-btn osr-btn--light" href="#rooms">Enter the gallery</a>
            <Link className="osr-textlink osr-textlink--light" href="/collections#ribbons">Explore the ribbons</Link>
          </div>
        </div>

        <div className="osr-hero-scroll" aria-hidden="true">Scroll to enter</div>
        <div className="osr-hero-label">
          <span>No. 01 — Pearl White</span>
          <strong>Hand-torn silk crêpe satin, 19 momme</strong>
          <small>
            Live product photography · {freeEnabled ? `complimentary shipping over ${formatGBP(freeThreshold)}` : 'worldwide shipping available'}
          </small>
        </div>
      </div>
    </section>
  )
}
