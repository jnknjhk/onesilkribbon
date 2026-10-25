import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { COLLECTION_META } from '@/lib/collection-content'

export const revalidate = 60

export const metadata = {
  title: 'All Collections',
  description: 'Shop fine and hand-frayed silk ribbons, vintage crinkle ribbon, handcrafted mini bows, brooches and wooden spools. Compare materials and available options.',
  alternates: { canonical: '/collections' },
}

const COLLECTIONS = Object.entries(COLLECTION_META).map(([slug, meta]) => ({ slug, ...meta }))

export default async function CollectionsPage() {
  const [catalog, pictures] = await Promise.all([
    supabaseAdmin.from('products').select('collection, images').eq('is_active', true),
    supabaseAdmin.from('site_images').select('key, url').in('key', COLLECTIONS.map(c => `home_col_${c.slug}`)),
  ])
  if (catalog.error) throw new Error('Unable to load collections')
  const products = catalog.data || []
  const imageMap = Object.fromEntries((pictures.data || []).map(row => [row.key, row.url]))
  const available = COLLECTIONS.map(collection => {
    const items = products.filter(product => product.collection === collection.slug)
    return { ...collection, count: items.length, image: imageMap[`home_col_${collection.slug}`] || items.find(p => Array.isArray(p.images) && p.images[0])?.images[0] }
  }).filter(collection => collection.count > 0)
  return (
    <div className="collections-page" style={{ paddingTop: 100, background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="section-header" style={{ paddingBottom: 80 }}>
        <span className="eyebrow" style={{ marginBottom: 20 }}>One Silk Ribbon</span>
        <h1 className="display-title">All <em>Collections</em></h1>
        <div className="rule" />
        <p style={{ fontSize: 14, color: 'var(--taupe)', lineHeight: 1.9, maxWidth: 480, margin: '28px auto 0' }}>
          Compare ribbon finishes, find a colour for your next project, or explore handcrafted details and wooden spools.
        </p>
        <Link href="/ribbon-guide" className="collections-guide-link">Not sure which ribbon to choose? Read the guide →</Link>
      </div>

      {/* Grid */}
      <div style={{ padding: '0 60px 120px' }} className="coll-page-pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 40 }} className="coll-page-grid">
          {available.map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} style={{ display: 'block' }}>
              <div style={{ overflow: 'hidden' }} className="coll-page-card">
                {/* Image */}
                <div style={{ aspectRatio: '16/9', background: c.bg, marginBottom: 28, overflow: 'hidden', position: 'relative' }}>
                  {c.image && <Image className="coll-page-img" src={c.image} alt={c.name} fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)' }} />}
                </div>
                {/* Info */}
                <div style={{ paddingBottom: 40, borderBottom: '1px solid var(--sand)' }}>
                  <div className="coll-page-card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)', lineHeight: 1.2 }}>
                      {c.name}
                    </h2>
                    <span className="eyebrow" style={{ flexShrink: 0, marginLeft: 24, marginTop: 4 }}>{c.count} {c.count === 1 ? 'product' : 'products'}</span>
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
        .collections-guide-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 20px; color: var(--deep); text-decoration: underline; text-underline-offset: 4px; }
        .coll-page-grid > a { min-width: 0; overflow-wrap: anywhere; }
        .coll-page-card:hover .coll-page-img { transform: scale(1.04); }
        .coll-page-card:hover .coll-line { width: 52px !important; }
        @media(max-width:900px) { .coll-page-grid{grid-template-columns:1fr !important} }
        @media(max-width:600px) {
          .collections-page { padding-top: 68px !important; }
          .collections-page > .section-header { padding: 40px 20px 36px !important; }
          .coll-page-pad { padding: 0 20px 64px !important; }
          .coll-page-grid { gap: 32px !important; }
          .coll-page-card-heading { flex-direction: column; gap: 12px; }
          .coll-page-card-heading .eyebrow { margin-left: 0 !important; }
          .coll-page-card-heading h2 { font-size: 26px !important; }
        }
      ` }} />
    </div>
  )
}
