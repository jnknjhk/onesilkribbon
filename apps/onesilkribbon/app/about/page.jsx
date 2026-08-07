import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'

export const revalidate = 3600

export const metadata = {
  title: 'Our Story',
  description: 'One Silk Ribbon began with a simple frustration: finding a silk ribbon that felt truly beautiful. Made with carefully chosen materials, with intention.',
  alternates: { canonical: '/about' },
}

const IMAGE_KEYS = ['about_hero', 'about_main', 'about_craft', 'about_colour', 'about_wedding', 'about_gifting', 'about_making']

const MADE_FOR = [
  {
    title: 'Weddings',
    body: 'For bouquets, invitations, table settings and the details that make a celebration feel personal.',
    cta: 'Explore Fine Silk Ribbons',
    href: '/collections/fine-silk-ribbons',
    imgKey: 'about_wedding',
  },
  {
    title: 'Gifting',
    body: 'For the moment before a gift is opened — when the wrapping becomes part of the experience.',
    cta: 'Explore Handcrafted Adornments',
    href: '/collections/handcrafted-adornments',
    imgKey: 'about_gifting',
  },
  {
    title: 'Making',
    body: 'For artists, makers and anyone who finds joy in working with beautiful materials.',
    cta: 'Explore Studio Tools',
    href: '/collections/studio-tools',
    imgKey: 'about_making',
  },
]

export default async function About() {
  const { data: images } = await supabaseServer.from('site_images').select('key, url').in('key', IMAGE_KEYS)
  const imgMap = Object.fromEntries((images || []).map(i => [i.key, i.url]))

  return (
    <>
      <div style={{ background: 'var(--cream)' }}>

        {/* HERO */}
        <div style={{ position: 'relative', paddingTop: 68, height: '72vh', minHeight: 440, overflow: 'hidden' }}>
          {imgMap.about_hero ? (
            <Image src={imgMap.about_hero} alt="One Silk Ribbon" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #E8DDD0 0%, #C4A882 100%)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(28,23,20,0.15) 0%, rgba(28,23,20,0.55) 100%)' }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 300, lineHeight: 1.15, color: '#fff', maxWidth: 680, marginBottom: 20 }}>
              Made for the beautiful details.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: 'rgba(255,255,255,0.85)', maxWidth: 480, marginBottom: 36 }}>
              Silk ribbons, handmade adornments, and carefully chosen materials for the moments worth making special.
            </p>
            <Link href="/collections" style={{
              display: 'inline-block', padding: '16px 40px', background: 'var(--gold)', color: '#fff',
              fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase', textDecoration: 'none',
            }}>Explore the Collection</Link>
          </div>
        </div>

        {/* WHERE IT BEGAN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: 1360, margin: '0 auto', padding: '0 60px' }} className="about-grid">
          <div style={{ padding: '96px 80px 96px 0', borderRight: '1px solid var(--sand)' }}>
            <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Where it began</p>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 18 }}>
              One Silk Ribbon began with a simple frustration: I couldn&rsquo;t find a ribbon that felt truly beautiful.
            </p>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 18 }}>
              I wanted something with softness, texture and character — something that felt as considered as the gift, bouquet or handmade piece it was meant to become part of. So I began with a simple idea: start with beautiful materials, and pay attention to the details.
            </p>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)' }}>
              Today, One Silk Ribbon brings together silk ribbons, handcrafted adornments and carefully selected materials for people who believe that the smallest details can change the feeling of something entirely. From a quiet gift wrapped by hand to the finishing touch on a wedding bouquet, we make and curate pieces designed to be used, touched and remembered.
            </p>
          </div>
          <div style={{ padding: '96px 0 96px 80px' }}>
            <div style={{ aspectRatio: '4/5', overflow: 'hidden', background: 'var(--sand)', position: 'relative' }}>
              {imgMap.about_main
                ? <Image src={imgMap.about_main} alt="Our Story" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #E8DDD0 0%, #C4A882 100%)' }} />}
            </div>
          </div>
        </div>

        {/* BRAND STATEMENT */}
        <div style={{ background: 'var(--sand)', borderTop: '1px solid var(--warm)', borderBottom: '1px solid var(--warm)', padding: '72px 60px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', maxWidth: 700, margin: '0 auto', lineHeight: 1.5 }}>
            &ldquo;The ribbon is never just an afterthought. It is the first thing you feel.&rdquo;
          </p>
        </div>

        {/* FROM MATERIAL TO DETAIL */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '96px 60px 0' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', marginBottom: 56, textAlign: 'center' }}>From material to detail</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48, marginBottom: imgMap.about_craft ? 72 : 0 }} className="values-grid">
            {[
              { title: 'The Material', head: 'Beautiful materials come first.', body: 'We work with carefully selected materials, including 100% Grade 6A mulberry silk, chosen for its softness, natural lustre and distinctive feel.' },
              { title: 'The Making',   head: 'Made with care.', body: 'Our hand-frayed silk ribbons are torn along the grain of the fabric, creating a naturally textured edge with the subtle irregularity that comes from being made by hand.' },
              { title: 'The Detail',   head: 'Small details matter.', body: 'Every piece is prepared with attention to the details that are easy to overlook — the texture, the edge, the colour and the way it feels in your hands.' },
            ].map(({ title, head, body }) => (
              <div key={title} style={{ paddingTop: 32, borderTop: '1px solid var(--sand)' }}>
                <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>{title}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.4 }}>{head}</p>
                <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.1, color: 'var(--taupe)' }}>{body}</p>
              </div>
            ))}
          </div>
          {imgMap.about_craft && (
            <div style={{ aspectRatio: '21/9', overflow: 'hidden', borderRadius: 2, position: 'relative' }}>
              <Image src={imgMap.about_craft} alt="Our Craft" fill loading="lazy" sizes="(max-width: 1360px) 100vw, 1360px" style={{ objectFit: 'cover' }} />
            </div>
          )}
        </div>

        {/* A WORLD OF COLOUR */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '96px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }} className="colour-grid">
          <div style={{ order: imgMap.about_colour ? 0 : 1 }}>
            <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>A World of Colour</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 300, color: 'var(--ink)', marginBottom: 20, lineHeight: 1.35 }}>
              Colour is one of the ways we tell stories.
            </p>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 28 }}>
              From quiet neutrals and soft, faded tones to deeper, more expressive shades, our collections are designed to offer colour for every kind of making. With over 200 colourways across our collections, there is always another shade to discover.
            </p>
            <Link href="/collections" style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', textDecoration: 'none' }}>
              Explore All Ribbons →
            </Link>
          </div>
          <div style={{ aspectRatio: '5/4', overflow: 'hidden', background: 'var(--sand)', position: 'relative' }}>
            {imgMap.about_colour
              ? <Image src={imgMap.about_colour} alt="A World of Colour" fill loading="lazy" sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #E8B4B8 0%, #C4A882 25%, #8B9A7A 50%, #A89BC4 75%, #D4C4A8 100%)' }} />}
          </div>
        </div>

        {/* MADE FOR THE MOMENTS */}
        <div style={{ background: 'var(--sand)', borderTop: '1px solid var(--warm)', borderBottom: '1px solid var(--warm)', padding: '96px 60px' }}>
          <div style={{ maxWidth: 1360, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', marginBottom: 56, textAlign: 'center' }}>Made for the moments in between</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }} className="made-for-grid">
              {MADE_FOR.map(({ title, body, cta, href, imgKey }) => (
                <Link key={title} href={href} style={{ display: 'block', textDecoration: 'none', background: 'var(--cream)' }}>
                  <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: 'var(--sand)', position: 'relative' }}>
                    {imgMap[imgKey]
                      ? <Image src={imgMap[imgKey]} alt={title} fill loading="lazy" sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #E8DDD0 0%, #C4A882 100%)' }} />}
                  </div>
                  <div style={{ padding: '28px 28px 32px' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--ink)', marginBottom: 12 }}>{title}</p>
                    <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2, color: 'var(--taupe)', marginBottom: 18 }}>{body}</p>
                    <span style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>{cta} →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* WHAT WE BELIEVE */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '96px 60px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', marginBottom: 56, textAlign: 'center' }}>What we believe</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }} className="values-grid">
            {[
              { title: 'Made slowly',      body: 'Some things are better when they are not rushed. We believe in taking the time to notice the details — the texture of silk, the edge of a ribbon, the way a colour changes in different light.' },
              { title: 'Chosen carefully', body: 'We choose materials for how they feel as much as how they look. From silk ribbons to the objects and tools we bring into the studio, everything has a reason for being here.' },
              { title: 'Meant to be used', body: 'Beautiful things should not simply sit on a shelf. Our ribbons are made to be tied, wrapped, gathered, sewn, worn and made part of something else.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ paddingTop: 32, borderTop: '1px solid var(--sand)' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.4 }}>{title}.</p>
                <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.1, color: 'var(--taupe)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CLOSING CTA */}
        <div style={{ borderTop: '1px solid var(--sand)', padding: '100px 60px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.3 }}>
            Find something beautiful to make with.
          </h2>
          <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 2.1, color: 'var(--taupe)', maxWidth: 480, margin: '0 auto 36px' }}>
            Whether you&rsquo;re wrapping a gift, styling a bouquet or beginning something entirely your own, we hope you&rsquo;ll find a material that feels right.
          </p>
          <Link href="/collections" style={{
            display: 'inline-block', padding: '16px 40px', background: 'var(--gold)', color: '#fff',
            fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase', textDecoration: 'none',
          }}>Explore the Collection</Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media(max-width: 900px) {
          .about-grid { grid-template-columns: 1fr !important; padding: 0 24px !important; }
          .about-grid > div { padding: 48px 0 !important; border-right: none !important; border-bottom: 1px solid var(--sand); }
          .values-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .colour-grid { grid-template-columns: 1fr !important; padding: 56px 24px !important; gap: 32px !important; }
          .colour-grid > div:first-child { order: 1 !important; }
          .made-for-grid { grid-template-columns: 1fr !important; }
          h1 { font-size: 34px !important; }
        }
      ` }} />
    </>
  )
}
