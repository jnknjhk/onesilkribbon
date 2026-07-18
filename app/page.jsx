import { createClient } from '@supabase/supabase-js'
import HomeClient from './HomeClient'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COLLECTION_SLUGS = [
  'fine-silk-ribbons','hand-frayed-silk-ribbons','handcrafted-adornments',
  'patterned-ribbons','studio-tools','vintage-inspired-ribbons',
]

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
  const { data: products } = await supabaseServer
    .from('products')
    .select('id, name, slug, images, collection')
    .eq('is_active', true)
    .limit(4)

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

  // ── Journal posts ─────────────────────────────────────────────────────────
  const { data: journalPosts } = await supabaseServer
    .from('journal_posts')
    .select('slug, title, category, excerpt, cover_image, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(3)

  return (
    <HomeClient
      heroImages={heroImages}
      storyImage={storyImage}
      collectionImages={collectionImages}
      featuredProducts={featuredProducts}
      journalPosts={journalPosts || []}
    />
  )
}
