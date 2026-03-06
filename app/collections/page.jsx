import Link from 'next/link'

export const metadata = {
  title: 'All Collections',
  description: 'Explore all six One Silk Ribbon collections — Fine Silk, Hand-Frayed, Adornments, Patterned, Studio Tools and Vintage-Inspired.',
}

const COLLECTIONS = [
  { name: 'Fine Silk Ribbons', slug: 'fine-silk-ribbons', desc: 'Our signature collection. Ultra-fine 100% mulberry silk ribbons in 30 hand-selected colourways, available in widths from 2mm to 10mm.', count: '30 colourways', bg: 'linear-gradient(160deg,#D4C5B0,#9A8878,#C4A882)' },
  { name: 'Hand-Frayed Silk Ribbons', slug: 'hand-frayed-silk-ribbons', desc: 'Each ribbon is carefully hand-frayed to create an ethereal, softly textured edge — perfect for bouquets, invitations and fine craft.', count: '18 styles', bg: 'linear-gradient(160deg,#E8C9B8,#C9A48A,#9A7A66)' },
  { name: 'Handcrafted Adornments', slug: 'handcrafted-adornments', desc: 'Silk scrunchies, bow ties, and decorative pieces — each made by hand from the same pure mulberry silk as our ribbons.', count: '12 designs', bg: 'linear-gradient(160deg,#B8A898,#7A6A5A,#4A3A30)' },
  { name: 'Patterned Ribbons', slug: 'patterned-ribbons', desc: 'Woven and printed motifs inspired by botanical forms, geometric patterns and heritage textiles. Each design printed on pure silk.', count: '14 patterns', bg: 'linear-gradient(160deg,#C8D4C0,#8A9A80,#5A7050)' },
  { name: 'Studio Tools', slug: 'studio-tools', desc: 'Curated essentials for the ribbon-maker and florist — scissors, wire, needles and everything you need for a well-appointed studio.', count: '8 essentials', bg: 'linear-gradient(160deg,#D0D0C8,#9A9A90,#5A5A54)' },
  { name: 'Vintage-Inspired Ribbons', slug: 'vintage-inspired-ribbons', desc: 'Heritage tones and antique-inspired textures, evoking the romance of a bygone era. Ideal for weddings, gifts and botanical styling.', count: '16 styles', bg: 'linear-gradient(160deg,#D4B8C0,#9A7A84,#5A3A44)' },
]

export default function CollectionsPage() {
  return (
    <div style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="section-header" style={{ paddingBottom: 80 }}>
        <span className="eyebrow" style={{ marginBottom: 20 }}>One Silk Ribbon</span>
        <h1 className="display-title">All <em>Collections</em></h1>
        <div className="rule" />
        <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 1.9, maxWidth: 480, margin: '28px auto 0' }}>
          Six expressions of pure mulberry silk — each collection a different facet of the same quiet beauty.
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

      <style>{`
        .coll-page-card:hover .coll-page-img { transform: scale(1.04); }
        .coll-page-card:hover .coll-line { width: 52px !important; }
        @media(max-width:900px) { .coll-page-grid{grid-template-columns:1fr !important} }
        @media(max-width:600px) { .coll-page-pad{padding:0 24px 80px !important} }
      `}</style>
    </div>
  )
}
