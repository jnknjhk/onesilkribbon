import { COLLECTIONS } from '@/config/site'
import Link from 'next/link'

export const metadata = {
  title: 'All Collections',
  description: 'Explore every One Glass Object collection — drinking glasses, vases, bowls and plates, and lighting. Hand-blown in the UK.',
  alternates: { canonical: '/collections' },
}


export default function CollectionsPage() {
  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="section-header" style={{ paddingBottom: 80 }}>
        <span className="eyebrow" style={{ marginBottom: 20 }}>One Glass Object</span>
        <h1 className="display-title">All <em>Collections</em></h1>
        <div className="rule" />
        <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 1.9, maxWidth: 480, margin: '28px auto 0' }}>
          Four ways into the same material — each collection a different facet of glass at its quietest.
        </p>
      </div>

      {/* Grid */}
      <div style={{ padding: '0 60px 120px' }} className="coll-page-pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 40 }} className="coll-page-grid">
          {COLLECTIONS.map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} style={{ display: 'block' }}>
              <div style={{ overflow: 'hidden' }} className="coll-page-card">
                {/* Image */}
                <div style={{ aspectRatio: '16/9', background: c.bg, marginBottom: 28, overflow: 'hidden' }}>
                  <div className="coll-page-img" style={{ width: '100%', height: '100%', background: c.bg, transition: 'transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
                </div>
                {/* Info */}
                <div style={{ paddingBottom: 40, borderBottom: '1px solid var(--sand)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)', lineHeight: 1.2 }}>
                      {c.name}
                    </h2>
                    <span className="eyebrow" style={{ flexShrink: 0, marginLeft: 24, marginTop: 4 }}>{c.count}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--taupe)', lineHeight: 1.9, marginBottom: 24 }}>{c.desc}</p>
                  <span style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--deep)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 28, height: 1, background: 'var(--gold)', display: 'inline-block', transition: 'width 0.4s' }} className="coll-line" />
                    Shop Collection
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .coll-page-card:hover .coll-page-img { transform: scale(1.04); }
        .coll-page-card:hover .coll-line { width: 52px !important; }
        @media(max-width:900px) { .coll-page-grid{grid-template-columns:1fr !important} }
        @media(max-width:600px) { .coll-page-pad{padding:0 24px 80px !important} }
      ` }} />
    </div>
  )
}
