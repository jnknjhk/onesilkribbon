import { supabaseAdmin } from '@osr/core/lib/supabase'
import { calculateTotals } from '@/lib/pricing'

// 服务端权威计价：绝不信任客户端传来的 price / totals，一切以数据库为准。
// 返回 { ok:true, lineItems, totals } 或 { ok:false, error, unavailable }
export async function computeAuthoritativeOrder({ items, couponCode, shippingSettings }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Your basket is empty' }
  }

  const skuIds = [...new Set(items.map(i => i.skuId).filter(Boolean))]
  if (skuIds.length === 0) {
    return { ok: false, error: 'Invalid basket items' }
  }

  const { data: skus, error } = await supabaseAdmin
    .from('product_skus')
    .select('id, product_id, price_gbp, stock_qty, is_active')
    .in('id', skuIds)

  if (error) {
    return { ok: false, error: 'Could not verify products, please try again' }
  }

  const skuMap = Object.fromEntries((skus || []).map(s => [s.id, s]))
  const unavailable = []
  const lineItems = []

  for (const item of items) {
    const sku = item.skuId ? skuMap[item.skuId] : null
    const qty = Math.max(1, parseInt(item.qty, 10) || 1)

    if (!sku || sku.is_active === false) {
      unavailable.push({ name: item.name || 'Item', reason: 'no longer available' })
      continue
    }
    if ((sku.stock_qty || 0) < qty) {
      unavailable.push({ name: item.name || 'Item', reason: `only ${sku.stock_qty || 0} left in stock` })
      continue
    }

    lineItems.push({
      skuId: sku.id,
      productId: item.productId || sku.product_id,
      name: item.name || 'Product',
      skuDesc: item.skuDesc || '',
      qty,
      price: parseFloat(sku.price_gbp) || 0, // 权威价格，来自数据库，而非客户端
    })
  }

  if (unavailable.length > 0) {
    return {
      ok: false,
      error: 'Some items in your basket are no longer available: ' +
        unavailable.map(u => `${u.name} (${u.reason})`).join(', '),
      unavailable,
    }
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.price * i.qty, 0)

  // 运费设置：调用方可以传入已查好的 shippingSettings，否则这里自己查
  let resolvedShippingSettings = shippingSettings
  if (!resolvedShippingSettings) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
    const map = Object.fromEntries((settingsRows || []).map(r => [r.key, r.value]))
    resolvedShippingSettings = {
      shippingRate: parseFloat(map.shipping_rate) || 0,
      freeShippingThreshold: parseFloat(map.free_shipping_threshold) || 45,
      freeShippingEnabled: map.free_shipping_enabled !== 'false',
    }
  }

  // 优惠券：服务端重新校验有效期 / 使用次数 / 最低订单额，绝不信任客户端算好的折扣金额
  let discountAmount = 0
  let appliedCouponCode = ''
  if (couponCode) {
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', String(couponCode).toUpperCase().trim())
      .eq('active', true)
      .single()

    if (coupon) {
      const notExpired = !coupon.expires_at || new Date(coupon.expires_at) >= new Date()
      const notOverused = coupon.max_uses === null || coupon.uses_count < coupon.max_uses
      const meetsMin = subtotal >= (coupon.min_order_gbp || 0)

      if (notExpired && notOverused && meetsMin) {
        if (coupon.discount_type === 'percentage') {
          discountAmount = parseFloat((subtotal * coupon.discount_value / 100).toFixed(2))
        } else {
          discountAmount = parseFloat(Math.min(coupon.discount_value, subtotal).toFixed(2))
        }
        // 确保折扣后金额不低于 Stripe 最低收款额 £0.30
        discountAmount = parseFloat(Math.min(discountAmount, Math.max(0, subtotal - 0.30)).toFixed(2))
        appliedCouponCode = coupon.code
      }
      // 优惠码不再有效时，静默忽略折扣（不阻断下单），但不会应用任何折扣
    }
  }

  const totals = calculateTotals(subtotal - discountAmount, resolvedShippingSettings)
  totals.discount = discountAmount.toFixed(2)
  totals.couponCode = appliedCouponCode

  return { ok: true, lineItems, totals }
}
