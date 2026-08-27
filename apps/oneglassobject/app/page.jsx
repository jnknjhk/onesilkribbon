import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import HomeClient from './HomeClient'
import { COLLECTION_SLUGS } from '@/config/site'

export const revalidate = 60


export default async function HomePage() {
  // ── 一次性取所有 site_images ──────────────────────────────────────────────
  const { data: siteImages } = await supabaseServer
    .from('site_images').select('key, url')

  const imgMap = {}
  if (siteImages) {
    for (const row of siteImages) imgMap[row.key] = row.url
  }

  // Hero images
  const heroImages = ['home_hero_1','home_hero_2','home_hero_3','home_hero_4','home_hero_5']
    .map(k => imgMap[k]).filter(Boolean)

  // Story image
  const storyImage = imgMap['home_story'] || null

  // ── Collection images: 没有 site_image 就从商品图取（一次查询）──────────────
  const missingCollections = COLLECTION_SLUGS.filter(s => !imgMap[`home_col_${s}`])

  let fallbackImgMap = {}
  if (missingCollections.length > 0) {
    const { data: colProds } = await supabaseServer
      .from('products')
      .select('collection, images')
      .in('collection', missingCollections)
      .eq('is_active', true)

    if (colProds) {
      for (const p of colProds) {
        if (fallbackImgMap[p.collection]) continue
        const imgs = Array.isArray(p.images) ? p.images : []
        if (imgs.length > 0) fallbackImgMap[p.collection] = imgs[0]
      }
    }
  }

  const collectionImages = {}
  for (const slug of COLLECTION_SLUGS) {
    collectionImages[slug] = imgMap[`home_col_${slug}`] || fallbackImgMap[slug] || null
  }

  // ── Featured products + SKUs（两次查询代替 N+1）──────────────────────────
  // Prefer featured products, fall back to any active products
  let { data: products } = await supabaseServer
    .from('products')
    .select('id, name, slug, images, collection')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .limit(4)

  if (!products || products.length === 0) {
    const { data: fallback } = await supabaseServer
      .from('products')
      .select('id, name, slug, images, collection')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .limit(4)
    products = fallback
  }

  let featuredProducts = []
  if (products && products.length > 0) {
    const productIds = products.map(p => p.id)
    const { data: allSkus } = await supabaseServer
      .from('product_skus')
      .select('product_id, price_gbp, colour_hex')
      .in('product_id', productIds)
      .order('price_gbp', { ascending: true })

    featuredProducts = products.map(p => {
      const skus = (allSkus || []).filter(s => s.product_id === p.id)
      return {
        ...p,
        price: skus[0]?.price_gbp || 0,
        swatches: skus.slice(0, 5).map(s => s.colour_hex).filter(Boolean),
      }
    })
  }

  // ── Shipping settings for marquee ────────────────────────────────────────
  const { data: shippingSettings } = await supabaseServer
    .from('settings')
    .select('key, value')
    .in('key', ['free_shipping_threshold', 'free_shipping_enabled'])
  const settingsMap = Object.fromEntries((shippingSettings || []).map(r => [r.key, r.value]))
  const freeThreshold = settingsMap['free_shipping_threshold'] || '45'
  const freeEnabled   = settingsMap['free_shipping_enabled'] !== 'false'

  return (
    <HomeClient
      heroImages={heroImages}
      storyImage={storyImage}
      collectionImages={collectionImages}
      featuredProducts={featuredProducts}
      freeThreshold={freeThreshold}
      freeEnabled={freeEnabled}
    />
  )
}
