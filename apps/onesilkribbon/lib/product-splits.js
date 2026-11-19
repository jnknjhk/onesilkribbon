import { variantUrl } from './product-variants'

export const FINE_SILK_SPLIT = {
  collection: 'fine-silk-ribbons', sourceSlug: '2mm-mulberry-silk-ribbon', settingsKey: 'fine_silk_ribbon_colours', members: 'colours',
}
export const WOOD_SPOOL_SPLIT = {
  collection: 'studio-tools', sourceSlug: 'artisan-wooden-spools', settingsKey: 'wooden_spool_sizes', members: 'sizes',
}
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function readProductSplit(db, split) {
  const { data, error } = await db.from('settings').select('value').eq('key', split.settingsKey).maybeSingle()
  if (error) throw new Error('Unable to load the product family.')
  return data ? JSON.parse(data.value) : null
}

export async function splitLegacyTarget(db, split, skuId, { familyOnly = false } = {}) {
  const collectionPath = `/collections/${split.collection}`
  const validId = typeof skuId === 'string' && uuid.test(skuId)
  const family = await readProductSplit(db, split)
  if (!family) return !familyOnly && validId ? variantUrl(`${collectionPath}/${split.sourceSlug}`, { id: skuId }) : null
  if (!validId) return collectionPath

  const { data, error } = await db.from('product_skus')
    .select('products!inner(slug)').eq('id', skuId).eq('is_active', true).gt('price_gbp', 0)
    .eq('products.is_active', true).eq('products.collection', split.collection)
    .in('product_id', Object.keys(family[split.members])).maybeSingle()
  if (error) throw new Error('Unable to resolve the old product link.')
  return data ? variantUrl(`${collectionPath}/${data.products.slug}`, { id: skuId }) : collectionPath
}
