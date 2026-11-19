import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import { permanentRedirect, notFound } from 'next/navigation'
import { findRenamedProduct } from '@osr/core/lib/product-redirects'
import { FINE_SILK_SOURCE_SLUG, fineSilkLegacyTarget } from '@/lib/fine-silk-ribbons'
import { WOOD_SPOOL_SPLIT, splitLegacyTarget } from '@/lib/product-splits'

// 跳转目标会变（商品换系列、改网址），不能按构建时的结果永久缓存
export const revalidate = 60

// These Shopify width-specific products were consolidated into the current
// 2–13mm product. Only map confirmed aliases; unknown products must remain 404.
const LEGACY_PRODUCT_SLUGS = {
  '4mm-mulberry-silk-ribbon': '2mm-mulberry-silk-ribbon',
  '7mm-mulberry-silk-ribbon': '2mm-mulberry-silk-ribbon',
}

// Resolve the current product instead of keeping a hard-coded collection URL.
// Shopify variant/country/currency parameters are not current SKU identifiers.
export default async function LegacyProductRedirect({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams
  const alias = Object.hasOwn(LEGACY_PRODUCT_SLUGS, slug) ? LEGACY_PRODUCT_SLUGS[slug] : null
  // Prefer an exact active product if a legacy slug is ever reused.
  for (const candidateSlug of [slug, alias].filter(Boolean)) {
    const { data: product, error } = await supabaseServer
      .from('products').select('slug, collection')
      .eq('slug', candidateSlug).eq('is_active', true).maybeSingle()
    if (error) throw new Error('Unable to resolve product redirect. Please try again.')

    if (candidateSlug === FINE_SILK_SOURCE_SLUG) {
      const target = await fineSilkLegacyTarget(supabaseServer, query?.sku, { familyOnly: !product })
      if (target) permanentRedirect(target)
    }
    if (candidateSlug === WOOD_SPOOL_SPLIT.sourceSlug && (!product || product.collection === WOOD_SPOOL_SPLIT.collection)) {
      const target = await splitLegacyTarget(supabaseServer, WOOD_SPOOL_SPLIT, query?.sku, { familyOnly: !product })
      if (target) permanentRedirect(target)
    }
    if (product) permanentRedirect(`/collections/${product.collection}/${product.slug}`)

    const moved = await findRenamedProduct(supabaseServer, candidateSlug)
    if (moved) permanentRedirect(`/collections/${moved.collection}/${moved.slug}`)
  }

  notFound()
}
