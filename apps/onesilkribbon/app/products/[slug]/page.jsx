import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import { permanentRedirect, notFound } from 'next/navigation'

// 旧的商品 URL 结构（/products/[slug]）——现在商品详情页挪到了
// /collections/[collectionSlug]/[productSlug]，这里只做 301，保住任何已经存在的外部链接/收藏/SEO 权重。
export default async function LegacyProductRedirect({ params }) {
  const { slug } = params
  const { data: product } = await supabaseServer
    .from('products').select('collection').eq('slug', slug).single()

  if (!product) notFound()

  permanentRedirect(`/collections/${product.collection}/${slug}`)
}
