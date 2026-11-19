import { merchantVariantAttributes, validSkus } from './product-variants'
import { FINE_SILK_SPLIT, readProductSplit, splitLegacyTarget } from './product-splits'

export const FINE_SILK_COLLECTION = FINE_SILK_SPLIT.collection
export const FINE_SILK_SOURCE_SLUG = FINE_SILK_SPLIT.sourceSlug

const collectionPath = `/collections/${FINE_SILK_COLLECTION}`
export const readFineSilkFamily = db => readProductSplit(db, FINE_SILK_SPLIT)
export const fineSilkLegacyTarget = (db, skuId, options) => splitLegacyTarget(db, FINE_SILK_SPLIT, skuId, options)

export async function fineSilkColourChoices(db, family) {
  const { data, error } = await db.from('products')
    .select('id,slug,images,attribute_config,product_skus!inner(id,attributes,colour,width_mm,length_m,price_gbp,is_active)')
    .eq('collection', FINE_SILK_COLLECTION).eq('is_active', true).eq('product_skus.is_active', true)
    .in('id', Object.keys(family.colours)).order('sort_order').order('slug')
  if (error) throw new Error('Unable to load fine silk ribbon colour links.')

  return (data || []).flatMap(product => {
    const skus = validSkus(product.product_skus)
    if (!skus.length) return []
    return [{
      id: product.id,
      name: family.colours[product.id],
      path: `${collectionPath}/${product.slug}`,
      image: product.images?.[0],
      sizes: Object.fromEntries(skus.map(sku => [merchantVariantAttributes(product, sku).size, sku.id])),
      firstSkuId: skus[0].id,
    }]
  })
}
