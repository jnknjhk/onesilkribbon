import { supabaseAdmin } from '@osr/core/lib/supabase'

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

// 支付成功后按行扣减库存。兼容 order_items 表行（sku_id/quantity）
// 和 PayPal session 里存的原始下单项（skuId/qty）两种字段命名。
//
// 走 decrement_sku_stock 这个数据库函数，而不是"先 select 再 update"。
// 后者在两笔订单同时结算、或 Stripe 把同一个 webhook 推两次时，两边会读到同样的旧值，
// 后写的把前一次的扣减覆盖掉——库存少扣就会超卖。单条 UPDATE 语句对同一行是串行的，
// 不会丢更新。
export async function deductStock(items) {
  for (const item of items) {
    const skuId = item.sku_id || item.skuId
    const qty = item.quantity ?? item.qty ?? 1
    if (!skuId) continue

    const { error } = await supabaseAdmin.rpc('decrement_sku_stock', {
      p_sku_id: skuId,
      p_qty: qty,
    })
    if (!error) continue

    // 迁移脚本还没在 Supabase 上执行时（代码先上线、SQL 后手动跑的那段时间），
    // 函数还不存在。这时退回旧的读改写——它有并发race，但"偶尔算错"远好过
    // "完全不扣库存"。执行过迁移脚本之后就不会再走到这里。
    if (/does not exist|schema cache|function/i.test(error.message || '')) {
      console.error('[deductStock] decrement_sku_stock 不存在，退回非原子扣减（请执行迁移脚本）')
      const { data: sku } = await supabaseAdmin
        .from('product_skus').select('stock_qty').eq('id', skuId).single()
      if (!sku) continue
      await supabaseAdmin.from('product_skus')
        .update({ stock_qty: Math.max(0, (sku.stock_qty || 0) - qty) })
        .eq('id', skuId)
      continue
    }

    // 库存没扣掉不该让已经付款的流程失败，但必须留痕——否则就是静默超卖
    console.error('[deductStock] 扣减失败', { skuId, qty, error: error.message })
  }
}

// 优惠券使用次数 +1。同样优先走原子的数据库函数，函数不存在时退回读改写。
export async function incrementCouponUses(code) {
  if (!code) return
  const { error } = await supabaseAdmin.rpc('increment_coupon_uses', { p_code: code })
  if (!error) return

  if (/does not exist|schema cache|function/i.test(error.message || '')) {
    console.error('[incrementCouponUses] increment_coupon_uses 不存在，退回非原子递增（请执行迁移脚本）')
    const normalized = String(code).toUpperCase().trim()
    const { data: cp } = await supabaseAdmin
      .from('coupons').select('uses_count').eq('code', normalized).maybeSingle()
    if (cp) {
      await supabaseAdmin.from('coupons')
        .update({ uses_count: (cp.uses_count || 0) + 1 })
        .eq('code', normalized)
    }
    return
  }

  console.error('[incrementCouponUses] 递增失败:', error.message)
}
