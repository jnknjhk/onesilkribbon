import { supabaseAdmin } from '@/lib/supabase'

// 校验购物车里所有商品是否还有足够库存
// 返回 { ok: true } 或 { ok: false, error: string, unavailable: [...] }
export async function checkStock(items) {
  if (!items || items.length === 0) return { ok: true }

  const skuIds = items.filter(i => i.skuId).map(i => i.skuId)
  if (skuIds.length === 0) return { ok: true } // 没有 skuId 就跳过校验（兼容旧数据）

  const { data: skus, error } = await supabaseAdmin
    .from('product_skus')
    .select('id, stock_qty, is_active')
    .in('id', skuIds)

  if (error) return { ok: true } // 查询失败不阻塞下单，避免误伤

  const skuMap = Object.fromEntries((skus || []).map(s => [s.id, s]))
  const unavailable = []

  for (const item of items) {
    if (!item.skuId) continue
    const sku = skuMap[item.skuId]
    if (!sku || sku.is_active === false) {
      unavailable.push({ name: item.name, reason: 'no longer available' })
      continue
    }
    if ((sku.stock_qty || 0) < (item.qty || 1)) {
      unavailable.push({ name: item.name, reason: `only ${sku.stock_qty || 0} left in stock` })
    }
  }

  if (unavailable.length > 0) {
    return {
      ok: false,
      error: 'Some items in your basket are no longer available: ' +
        unavailable.map(u => `${u.name} (${u.reason})`).join(', '),
      unavailable,
    }
  }

  return { ok: true }
}
