import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import { COLLECTION_SLUGS } from '@/lib/collections'
import { FREE_SHIPPING_THRESHOLD } from '@/lib/pricing'
import { RIBBON_HOUSES } from '@/lib/storefront-nav'
import HomeClient from './HomeClient'

export const revalidate = 60

const firstImage = product => {
  const images = Array.isArray(product?.images) ? product.images : []
  return images.find(image => typeof image === 'string' && image.trim()) || null
}

export default async function HomePage() {
  const [siteImageResult, productResult, journalResult, settingsResult] = await Promise.all([
    supabaseServer.from('site_images').select('key, url'),
    supabaseServer
      .from('products')
      .select('id, name, slug, images, collection, sort_order, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabaseServer
      .from('journal_posts')
      .select('slug, title, category, excerpt, cover_image, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3),
    supabaseServer
      .from('settings')
      .select('key, value')
      .in('key', ['free_shipping_threshold', 'free_shipping_enabled']),
  ])

  if (productResult.error) throw new Error('Unable to load the studio catalogue. Please try again.')

  const imgMap = {}
  for (const row of siteImageResult.data || []) imgMap[row.key] = row.url

  const products = productResult.data || []
  const productIds = products.map(product => product.id)

  let skuRows = []
  if (productIds.length > 0) {
    const { data, error } = await supabaseServer
      .from('product_skus')
      .select('product_id, price_gbp, colour_hex, stock_qty')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('price_gbp', { ascending: true })
    if (error) throw new Error('Unable to load studio prices. Please try again.')
    skuRows = data || []
  }

  const skusByProduct = new Map()
  for (const sku of skuRows) {
    if (!skusByProduct.has(sku.product_id)) skusByProduct.set(sku.product_id, [])
    skusByProduct.get(sku.product_id).push(sku)
  }

  const productSummary = product => {
    const skus = skusByProduct.get(product.id) || []
    const prices = skus.map(sku => Number(sku.price_gbp)).filter(price => Number.isFinite(price) && price > 0)
    const hexes = [...new Set(skus.map(sku => sku.colour_hex).filter(hex => typeof hex === 'string' && hex.trim()))].slice(0, 4)
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      collection: product.collection,
      image: firstImage(product),
      minPrice: prices.length ? Math.min(...prices) : 0,
      skuCount: skus.length,
      hexes,
    }
  }

  const bySlug = new Map(products.map(product => [product.slug, product]))

  const collectionStats = {}
  for (const slug of COLLECTION_SLUGS) {
    const items = products.filter(product => product.collection === slug)
    const prices = items
      .map(product => productSummary(product).minPrice)
      .filter(price => price > 0)
    collectionStats[slug] = {
      slug,
      count: items.length,
      image: imgMap[`home_col_${slug}`] || firstImage(items[0]) || null,
      minPrice: prices.length ? Math.min(...prices) : 0,
      skuCount: items.reduce((total, product) => total + (skusByProduct.get(product.id)?.length || 0), 0),
    }
  }

  const handFrayed = products.filter(product => product.collection === 'hand-frayed-silk-ribbons')
  const vintage = products.filter(product => product.collection === 'vintage-inspired-ribbons')
  const cabinetSlugs = [
    'pearl-white-hand-frayed-silk-ribbon',
    'lotus-pink-hand-frayed-silk-ribbon',
    'burgundy',
    '10mm-vintage-crinkle-silk-ribbon-on-wooden-spool-100-pure-mulberry-silk',
  ]
  const cabinetProducts = []
  for (const slug of cabinetSlugs) {
    const product = bySlug.get(slug)
    if (product) cabinetProducts.push(product)
  }
  for (const product of [...handFrayed, ...vintage]) {
    if (cabinetProducts.length >= 4) break
    if (!cabinetProducts.includes(product)) cabinetProducts.push(product)
  }
  const ribbonCabinet = cabinetProducts.slice(0, 4).map(productSummary)

  const ribbonHouses = RIBBON_HOUSES.map(house => {
    const stats = collectionStats[house.slug]
    return { ...house, count: stats?.count || 0, skuCount: stats?.skuCount || 0, minPrice: stats?.minPrice || 0, image: stats?.image || null }
  }).filter(house => house.count > 0)

  const studioToolsCollection = products.filter(product => product.collection === 'studio-tools')
  const toolSlugs = [
    'artisan-wooden-spool-2-3-x-3cm',
    'adjustable-beechwood-embroidery-hoop',
    'adjustable-beechwood-embroidery-stand',
  ]
  const studioToolProducts = []
  for (const slug of toolSlugs) {
    const product = bySlug.get(slug)
    if (product) studioToolProducts.push(product)
  }
  for (const product of studioToolsCollection) {
    if (studioToolProducts.length >= 3) break
    if (!studioToolProducts.includes(product)) studioToolProducts.push(product)
  }
  const studioTools = studioToolProducts.slice(0, 3).map(productSummary)

  const ribbonCount = ribbonHouses.reduce((total, house) => total + house.count, 0)
  const doors = [
    {
      number: '01',
      title: 'Silk Ribbons',
      href: '/collections#ribbons',
      image: collectionStats['hand-frayed-silk-ribbons']?.image || ribbonHouses[0]?.image || null,
      alt: 'Pearl White hand-frayed silk ribbon wound on a vintage wooden spool',
      badge: 'Live collection',
      copy: `Fine embroidery ribbon, hand-torn crêpe satin and vintage crinkle — ${ribbonCount} live pieces across three ribbon houses.`,
      cta: 'Enter the ribbon house',
      links: ribbonHouses.map(house => ({ label: house.label, href: house.href })),
    },
    {
      number: '02',
      title: 'Handcrafted Adornments',
      href: '/collections/handcrafted-adornments',
      image: collectionStats['handcrafted-adornments']?.image || null,
      alt: 'Handcrafted silk mini bows and ribbon-embroidered brooches',
      badge: 'Live collection',
      copy: `${collectionStats['handcrafted-adornments']?.count || 0} hand-finished pieces — mulberry silk mini bows and ribbon-embroidered brooches.`,
      cta: 'Enter the adornment room',
      links: [],
    },
    {
      number: '03',
      title: 'Studio Tools',
      href: '/collections/studio-tools',
      image: collectionStats['studio-tools']?.image || null,
      alt: 'Beechwood tabletop embroidery stand holding a hoop of silk ribbon flowers',
      badge: 'Live collection',
      copy: `${collectionStats['studio-tools']?.count || 0} beechwood tools — ribbon spools, adjustable hoops and a tabletop embroidery stand.`,
      cta: 'Enter the workbench',
      links: [],
    },
  ]

  const fabricStats = collectionStats['silk-fabric']
  if ((fabricStats?.count || 0) > 0 && fabricStats.minPrice > 0) {
    doors.splice(1, 0, {
      number: '02',
      title: 'Silk Fabric by the Metre',
      href: '/collections/silk-fabric',
      image: fabricStats.image || null,
      alt: 'Silk fabric cut to order by the metre',
      badge: 'Live collection',
      copy: `${fabricStats.count} ${fabricStats.count === 1 ? 'cloth' : 'cloths'} cut to order by the metre — browse by fabric type, use or weight.`,
      cta: 'Enter the fabric room',
      links: [
        { label: 'By fabric type', href: '/collections/silk-fabric#by-type' },
        { label: 'By use', href: '/collections/silk-fabric#by-use' },
        { label: 'By weight', href: '/collections/silk-fabric#by-weight' },
      ],
    })
  }
  doors.forEach((door, index) => { door.number = String(index + 1).padStart(2, '0') })

  const settingsMap = Object.fromEntries((settingsResult.data || []).map(row => [row.key, row.value]))
  const freeThreshold = settingsMap.free_shipping_threshold || FREE_SHIPPING_THRESHOLD
  const freeEnabled = settingsMap.free_shipping_enabled !== 'false'

  const storyImage = imgMap.home_story || collectionStats['hand-frayed-silk-ribbons']?.image || '/images/silk-gallery/hero-desktop.jpg'

  return (
    <HomeClient
      doors={doors}
      ribbonHouses={ribbonHouses}
      ribbonCabinet={ribbonCabinet}
      studioTools={studioTools}
      storyImage={storyImage}
      journalPosts={journalResult.data || []}
      freeThreshold={freeThreshold}
      freeEnabled={freeEnabled}
    />
  )
}
