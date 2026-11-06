import { api } from '../../lib/api'

// 复制：读完整商品 + 全部 SKU（含已停用的），新建一个下架的副本
export async function duplicateProduct(id) {
  const { product: p, skus } = await api(`/api/admin/products?id=${id}`)
  const res = await api('/api/admin/products', { method: 'POST', body: {
    action: 'create',
    product: {
      name: `${p.name} (Copy)`,
      slug: `${p.slug}-copy-${Date.now().toString().slice(-4)}`,
      description: p.description,
      collection: p.collection,
      is_active: false,
      is_featured: false,
      sort_order: p.sort_order || 0,
      images: p.images || [],
      attribute_config: p.attribute_config || [],
      specifications: p.specifications || [],
    },
    // 以前复制时没带 colour / width_mm / length_m，属性里没写这几项的 SKU 复制出来就丢了
    skus: (skus || []).map(k => ({
      attributes: k.attributes, colour: k.colour, colour_hex: k.colour_hex,
      width_mm: k.width_mm, length_m: k.length_m,
      price_gbp: k.price_gbp, stock_qty: k.stock_qty, is_active: k.is_active, images: k.images || [],
    })),
  } })
  if (!res.id) throw new Error(res.error || '复制失败')
  return res.id
}
