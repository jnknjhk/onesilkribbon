import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { COLLECTION_META } from '@/lib/collection-content'
import { RIBBON_HOUSES, RIBBON_HOUSE_SLUGS } from '@/lib/storefront-nav'
import Reveal from '@/components/home/Reveal'

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
    supabaseAdmin.from('site_images').select('key, url').in('key', COLLECTIONS.map(collection => `home_col_${collection.slug}`)),
  ])
  if (catalog.error) throw new Error('Unable to load collections')
  const products = catalog.data || []
  const imageMap = Object.fromEntries((pictures.data || []).map(row => [row.key, row.url]))
  const available = COLLECTIONS.map(collection => {
    const items = products.filter(product => product.collection === collection.slug)
    return {
      ...collection,
      count: items.length,
      image: imageMap[`home_col_${collection.slug}`] || items.find(product => Array.isArray(product.images) && product.images[0])?.images[0] || null,
    }
  }).filter(collection => collection.count > 0)

  const ribbonHouseItems = () => RIBBON_HOUSES.map(config => {
    const item = available.find(collection => collection.slug === config.slug)
    if (!item) return null
    return { ...config, count: item.count, image: item.image, desc: item.desc }
  }).filter(Boolean)

  const otherCollectionItems = () => available.filter(collection =>
    !RIBBON_HOUSE_SLUGS.includes(collection.slug) && collection.slug !== 'silk-fabric'
  )
  const fabricItem = available.find(collection => collection.slug === 'silk-fabric') || null

  return (
    <div className="collections-page">
      <header className="osr-collections-head osr-container">
        <span className="osr-eyebrow">One Silk Ribbon</span>
        <h1 className="osr-title">All <em>Collections</em></h1>
        <div style={{ width: 40, height: 1, background: 'var(--osr-gold)', margin: '24px auto 0' }} />
        <p>
          Compare ribbon finishes, find a colour for your next project, or explore handcrafted details and the wooden tools of the studio.
        </p>
        <Link href="/ribbon-guide" className="osr-textlink">Not sure which ribbon to choose? Read the guide</Link>
      </header>

      {ribbonHouseItems().length > 0 && (
        <section className="osr-houses-section osr-container" id="ribbons">
          <div className="osr-houses-section-head">
            <div>
              <span className="osr-eyebrow">Silk Ribbons</span>
              <h2>Three ribbon houses.</h2>
            </div>
            <p>Ultra-fine embroidery ribbon, hand-torn crêpe satin and a vintage crinkle — each house has its own hand and its own use.</p>
          </div>

          <div className="osr-houses-grid">
            {ribbonHouseItems().map((house, index) => (
              <Reveal key={house.slug} className="osr-house-card" delay={index * 80}>
                <Link href={house.href} className="osr-house-media" aria-label={house.label}>
                  {house.image ? (
                    <Image src={house.image} alt={house.label} fill sizes="(max-width: 960px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: house.bg }} />
                  )}
                </Link>
                <div className="osr-house-body">
                  <h3><Link href={house.href}>{house.label}</Link></h3>
                  <p>{house.blurb}</p>
                  <div className="osr-house-meta">
                    <span>{house.count} {house.slug === 'vintage-inspired-ribbons' ? (house.count === 1 ? 'ribbon' : 'ribbons') : 'colourways'}</span>
                    <span>{house.note}</span>
                  </div>
                  <Link className="osr-textlink" href={house.href}>Browse {house.label}</Link>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {fabricItem && (
        <section className="osr-fabric-entry osr-container" id="fabric">
          <div className="osr-fabric-entry-grid">
            <Link href="/collections/silk-fabric" className="osr-fabric-entry-media" aria-label={fabricItem.name}>
              {fabricItem.image ? (
                <Image src={fabricItem.image} alt={fabricItem.name} fill sizes="(max-width: 960px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, background: fabricItem.bg }} />
              )}
              <span className="osr-badge osr-badge--ink">Live collection · {fabricItem.count} {fabricItem.count === 1 ? 'cloth' : 'cloths'}</span>
            </Link>
            <div className="osr-fabric-entry-body">
              <span className="osr-eyebrow">Silk Fabric by the Metre</span>
              <h2>Cloth, cut to order.</h2>
              <p>{fabricItem.desc}</p>
              <div className="osr-fabric-entry-links">
                <Link href="/collections/silk-fabric#by-type">By fabric type</Link>
                <Link href="/collections/silk-fabric#by-use">By use</Link>
                <Link href="/collections/silk-fabric#by-weight">By weight</Link>
              </div>
              <Link className="osr-textlink" href="/collections/silk-fabric">Browse the fabric library</Link>
            </div>
          </div>
        </section>
      )}

      {otherCollectionItems().length > 0 && (
        <section className="osr-collections-other osr-container">
          <div className="osr-collections-other-head">
            <span className="osr-eyebrow">More from the studio</span>
            <h2 style={{ marginTop: 12 }}>Adornments &amp; tools.</h2>
          </div>

          <div className="osr-collection-grid">
            {otherCollectionItems().map((collection, index) => (
              <Reveal key={collection.slug} className="osr-collection-card" delay={index * 80}>
                <Link href={`/collections/${collection.slug}`} className="osr-collection-media" aria-label={collection.name}>
                  {collection.image ? (
                    <Image src={collection.image} alt={collection.name} fill sizes="(max-width: 960px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: collection.bg }} />
                  )}
                </Link>
                <div className="osr-collection-card-body">
                  <div className="osr-collection-card-head">
                    <h3><Link href={`/collections/${collection.slug}`}>{collection.name}</Link></h3>
                    <span>{collection.count} {collection.count === 1 ? 'product' : 'products'}</span>
                  </div>
                  <p>{collection.desc}</p>
                  <Link className="osr-textlink" href={`/collections/${collection.slug}`}>Shop the collection</Link>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
