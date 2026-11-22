// This module is used by admin route handlers only.
import { createHash } from 'node:crypto'

export async function canAccessInternalProductNames(db, admin) {
  const email = admin?.email?.trim().toLowerCase()
  if (!email) return false
  const hash = createHash('sha256').update(email).digest('hex')
  const { data, error } = await db.from('product_internal_name_access').select('id').eq('owner_email_hash', hash).maybeSingle()
  return !error && data?.id === true
}

export async function attachInternalPackingNames(db, items) {
  const skuIds = [...new Set(items.map(item => item.sku_id).filter(Boolean))]
  const { data: skus, error: skuError } = skuIds.length
    ? await db.from('product_skus').select('id, product_id').in('id', skuIds)
    : { data: [] }
  if (skuError) throw skuError
  const bySku = new Map(skus.map(sku => [sku.id, sku.product_id]))
  const productIds = [...new Set(items.flatMap(item => [item.product_id, bySku.get(item.sku_id)]).filter(Boolean))]
  if (!productIds.length) return items

  const { data: aliases, error } = await db.from('product_internal_names').select('product_id, internal_name').in('product_id', productIds)
  if (error) throw error
  const byProduct = new Map(aliases.map(row => [row.product_id, row.internal_name]))
  return items.map(item => {
    // Legacy orders still point at the original listing; the same SKU now belongs to a colour product.
    const name = byProduct.get(item.product_id) || byProduct.get(bySku.get(item.sku_id))
    if (!name) return item
    const width = item.sku_description?.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*mm\b/i)?.[1]
    return { ...item, internal_name: name, packing_width: width ? `${width} mm` : null }
  })
}
