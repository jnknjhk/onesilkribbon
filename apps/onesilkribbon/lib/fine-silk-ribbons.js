import { merchantVariantAttributes, validSkus, variantUrl } from './product-variants'

export const FINE_SILK_COLLECTION = 'fine-silk-ribbons'
export const FINE_SILK_SOURCE_SLUG = '2mm-mulberry-silk-ribbon'
export const FINE_SILK_SETTINGS_KEY = 'fine_silk_ribbon_colours'

const collectionPath = `/collections/${FINE_SILK_COLLECTION}`
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function readFineSilkFamily(db) {
  const { data, error } = await db.from('settings').select('value').eq('key', FINE_SILK_SETTINGS_KEY).maybeSingle()
  if (error) throw new Error('Unable to load fine silk ribbon colours.')
  return data ? JSON.parse(data.value) : null
}

export async function fineSilkLegacyTarget(db, skuId, { familyOnly = false } = {}) {
  const family = await readFineSilkFamily(db)
  if (!family) {
    return !familyOnly && typeof skuId === 'string' && uuid.test(skuId)
      ? variantUrl(`${collectionPath}/${FINE_SILK_SOURCE_SLUG}`, { id: skuId })
      : null
  }
  if (typeof skuId !== 'string' || !uuid.test(skuId)) return collectionPath

  const { data, error } = await db.from('product_skus')
    .select('products!inner(slug,collection)')
    .eq('id', skuId).eq('is_active', true).gt('price_gbp', 0)
    .eq('products.is_active', true).eq('products.collection', FINE_SILK_COLLECTION)
    .in('product_id', Object.keys(family.colours)).maybeSingle()
  if (error) throw new Error('Unable to resolve the fine silk ribbon link.')
  return data ? variantUrl(`${collectionPath}/${data.products.slug}`, { id: skuId }) : collectionPath
}

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
