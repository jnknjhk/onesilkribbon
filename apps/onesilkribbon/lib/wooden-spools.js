import { WOOD_SPOOL_SPLIT, readProductSplit } from './product-splits'
import { merchantVariantAttributes, validSkus } from './product-variants'

export const readWoodSpoolFamily = db => readProductSplit(db, WOOD_SPOOL_SPLIT)

export async function woodSpoolSizeChoices(db, family) {
  const { data, error } = await db.from('products')
    .select('id,slug,attribute_config,product_skus!inner(id,attributes,colour,price_gbp)')
    .eq('collection', WOOD_SPOOL_SPLIT.collection).eq('is_active', true).eq('product_skus.is_active', true)
    .in('id', Object.keys(family.sizes)).order('sort_order').order('slug')
  if (error) throw new Error('Unable to load the wooden spool sizes.')

  return (data || []).flatMap(product => {
    const skus = validSkus(product.product_skus)
    if (!skus.length) return []
    return [{
      id: product.id,
      name: family.sizes[product.id].replace('cm*', ' × ').replace(/cm$/, ' cm'),
      path: `/collections/${WOOD_SPOOL_SPLIT.collection}/${product.slug}`,
      finishes: Object.fromEntries(skus.map(sku => [merchantVariantAttributes(product, sku).color, sku.id])),
      firstSkuId: skus[0].id,
    }]
  })
}
