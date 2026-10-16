import { supabaseAdmin } from '@osr/core/lib/supabase'
import { calculateTotals, gbpToPence, penceToGBP, cartSubtotalPence, couponDiscountPence } from '@/lib/pricing'

// 服务端权威计价：绝不信任客户端传来的 price / totals，一切以数据库为准。
// 返回 { ok:true, lineItems, totals } 或 { ok:false, error, unavailable }
export async function computeAuthoritativeOrder({ items, couponCode, shippingSettings } = {}) {
  if (couponCode !== undefined && (typeof couponCode !== 'string' || couponCode.length > 100)) return { ok: false, error: 'Invalid promo code' }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Your basket is empty' }
  }

  if (items.length > 200) return { ok: false, error: 'Too many basket items' }
  const grouped = new Map()
  for (const item of items) {
    if (!item || !['string', 'number'].includes(typeof item.qty)) return { ok: false, error: 'Invalid basket quantity' }
    const qty = Number(item?.qty)
    if (typeof item?.skuId !== 'string' || !item.skuId.trim() || item.skuId.length > 100 || !['string','number'].includes(typeof item.qty) || !Number.isSafeInteger(qty) || qty < 1 || qty > 10000) {
      return { ok: false, error: 'Invalid basket quantity' }
    }
    const totalQty = (grouped.get(item.skuId)?.qty || 0) + qty
    if (totalQty > 10000) return { ok: false, error: 'Invalid basket quantity' }
    grouped.set(item.skuId, { ...item, qty: totalQty })
  }
  const skuIds = [...grouped.keys()]

  // Pricing and coupon preview are read-only; reservation expiry runs elsewhere.

  const { data: skus, error } = await supabaseAdmin
    .from('product_skus')
    .select('id, product_id, price_gbp, stock_qty, is_active, colour, width_mm, length_m')
    .in('id', skuIds)

  if (error) {
    return { ok: false, error: 'Could not verify products, please try again' }
  }

  const { data: products, error: productError } = await supabaseAdmin.from('products')
    .select('id,name,is_active').in('id', [...new Set((skus || []).map(s => s.product_id))])
  if (productError) return { ok: false, error: 'Could not verify products, please try again' }
  const productMap = Object.fromEntries((products || []).map(p => [p.id, p]))

  const skuMap = Object.fromEntries((skus || []).map(s => [s.id, s]))
  const unavailable = []
  const lineItems = []

  for (const item of grouped.values()) {
    const sku = item.skuId ? skuMap[item.skuId] : null
    const qty = item.qty
    const product = sku && productMap[sku.product_id]

    if (!sku || sku.is_active === false || !product || product.is_active !== true) {
      unavailable.push({ name: item.name || 'Item', reason: 'no longer available' })
      continue
    }
    if (!Number.isFinite(Number(sku.price_gbp)) || Number(sku.price_gbp) <= 0) {
      unavailable.push({ name: product.name, reason: 'price unavailable' })
      continue
    }
    if ((sku.stock_qty || 0) < qty) {
      unavailable.push({ name: item.name || 'Item', reason: `only ${sku.stock_qty || 0} left in stock` })
      continue
    }

    lineItems.push({
      skuId: sku.id,
      productId: sku.product_id,
      name: product.name,
      skuDesc: [sku.width_mm ? `${sku.width_mm}mm` : '', sku.colour, sku.length_m ? `${sku.length_m}m` : ''].filter(Boolean).join(' · '),
      qty,
      price: sku.price_gbp, // Preserve the database decimal for exact arithmetic.
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

  let subtotalPence
  try { subtotalPence = cartSubtotalPence(lineItems) }
  catch { return { ok: false, error: 'Could not verify product prices' } }
  const subtotal = penceToGBP(subtotalPence)

  // 运费设置：调用方可以传入已查好的 shippingSettings，否则这里自己查
  let resolvedShippingSettings = shippingSettings
  if (!resolvedShippingSettings) {
    const { data: settingsRows, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
    if (settingsError) return { ok: false, error: 'Could not verify shipping, please try again' }
    const map = Object.fromEntries((settingsRows || []).map(r => [r.key, r.value]))
    resolvedShippingSettings = {
      shippingRate: map.shipping_rate ?? 3.95,
      freeShippingThreshold: map.free_shipping_threshold ?? 45,
      freeShippingEnabled: map.free_shipping_enabled !== 'false',
    }
  }

  // 优惠券：服务端重新校验有效期 / 使用次数 / 最低订单额，绝不信任客户端算好的折扣金额
  let discountAmount = 0
  let appliedCouponCode = ''
  if (couponCode) {
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('code,discount_type,discount_value,min_order_gbp,max_uses,uses_count,expires_at')
      .eq('code', String(couponCode).toUpperCase().trim())
      .eq('active', true)
      .single()

    if (coupon) {
      const notExpired = !coupon.expires_at || new Date(coupon.expires_at) >= new Date()
      const notOverused = coupon.max_uses === null || coupon.uses_count < coupon.max_uses
      let meetsMin = false
      try { meetsMin = subtotalPence >= gbpToPence(coupon.min_order_gbp ?? 0) } catch {}

      if (notExpired && notOverused && meetsMin) {
        try {
          discountAmount = couponDiscountPence(coupon, subtotalPence)
          appliedCouponCode = coupon.code
        } catch {}
      }
    }
    if (!appliedCouponCode) return { ok: false, error: 'This promo code is no longer valid. Please review your basket.' }
  }

  let totals
  try { totals = calculateTotals(subtotal, resolvedShippingSettings, penceToGBP(discountAmount)) }
  catch { return { ok: false, error: 'Could not verify shipping, please try again' } }
  totals.discount = penceToGBP(discountAmount)
  totals.couponCode = appliedCouponCode

  return { ok: true, lineItems, totals }
}
