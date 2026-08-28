import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import HomeClient from './HomeClient'
import { COLLECTION_SLUGS } from '@/config/site'

export const revalidate = 60

/**
 * 首页数据层。
 *
 * 原则：查询次数固定，不随商品数量增长（不做 N+1）。
 * 服务端用的是 service role，RLS 不会自动过滤，所以每个查询都必须
 * 自己带上 is_active = true。
 */
export default async function HomePage() {
  // ── 站点图片：一次取全，本地建索引 ────────────────────────────
  const { data: siteImages } = await supabaseServer
    .from('site_images')
    .select('key, url')

  const imgMap = {}
  for (const row of siteImages || []) imgMap[row.key] = row.url

  const heroImages = ['home_hero_1', 'home_hero_2', 'home_hero_3', 'home_hero_4', 'home_hero_5']
    .map(k => imgMap[k])
    .filter(Boolean)

  const storyImage = imgMap['home_story'] || null

  // ── 系列配图：后台没单独设的，退回用该系列任一商品的首图 ──────
  const missing = COLLECTION_SLUGS.filter(s => !imgMap[`home_col_${s}`])

  const fallbackImg = {}
  if (missing.length > 0) {
    const { data: colProds } = await supabaseServer
      .from('products')
      .select('collection, images')
      .in('collection', missing)
      .eq('is_active', true)

    for (const p of colProds || []) {
      if (fallbackImg[p.collection]) continue
      const imgs = Array.isArray(p.images) ? p.images : []
      if (imgs.length > 0) fallbackImg[p.collection] = imgs[0]
    }
  }

  const collectionImages = {}
  for (const slug of COLLECTION_SLUGS) {
    collectionImages[slug] = imgMap[`home_col_${slug}`] || fallbackImg[slug] || null
  }

  // ── 精选作品：优先取 is_featured，没有就退回任意在售商品 ───────
  let { data: products } = await supabaseServer
    .from('products')
    .select('id, name, slug, images, collection')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .limit(3)

  if (!products || products.length === 0) {
    const { data: fallback } = await supabaseServer
      .from('products')
      .select('id, name, slug, images, collection')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .limit(3)
    products = fallback
  }

  let featuredProducts = []
  if (products && products.length > 0) {
    // 一次取回这批商品的所有在售 SKU，避免每个商品单独查一次
    const { data: allSkus } = await supabaseServer
      .from('product_skus')
      .select('product_id, price_gbp')
      .in('product_id', products.map(p => p.id))
      .eq('is_active', true)
      .order('price_gbp', { ascending: true })

    featuredProducts = products.map(p => {
      const skus = (allSkus || []).filter(s => s.product_id === p.id)
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        collection: p.collection,
        image: Array.isArray(p.images) ? p.images[0] || null : null,
        price: skus[0]?.price_gbp || 0,
        // 玻璃件大多只有一个默认 SKU。只有真的存在多个价位时，
        // 前台才写 "From £x"，否则直接写确定价格。
        skuCount: skus.length,
      }
    })
  }

  // ── 运费设置：用于首页底部那行安静的配送说明 ──────────────────
  const { data: shippingSettings } = await supabaseServer
    .from('settings')
    .select('key, value')
    .in('key', ['free_shipping_threshold', 'free_shipping_enabled'])

  const settingsMap = Object.fromEntries((shippingSettings || []).map(r => [r.key, r.value]))

  return (
    <HomeClient
      heroImages={heroImages}
      storyImage={storyImage}
      collectionImages={collectionImages}
      featuredProducts={featuredProducts}
      freeThreshold={settingsMap['free_shipping_threshold'] || '45'}
      freeEnabled={settingsMap['free_shipping_enabled'] !== 'false'}
    />
  )
}
