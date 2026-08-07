// 默认兜底值
export const FREE_SHIPPING_THRESHOLD = 45.00
export const SHIPPING_RATE = 3.95

/**
 * 计算订单总额
 * 商品标价已含税（VAT included in price），结算时只加运费
 * shippingSettings 从数据库读取
 */
export function calculateTotals(subtotal, shippingSettings) {
  const safeSubtotal = parseFloat(subtotal) || 0

  const shippingRate          = shippingSettings?.shippingRate          ?? SHIPPING_RATE
  const freeShippingThreshold = shippingSettings?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD
  const freeShippingEnabled   = shippingSettings?.freeShippingEnabled   ?? true

  const isFree   = freeShippingEnabled && safeSubtotal >= freeShippingThreshold
  const shipping = isFree ? 0 : shippingRate
  const total    = parseFloat((safeSubtotal + shipping).toFixed(2))

  return {
    subtotal:             safeSubtotal.toFixed(2),
    shipping:             parseFloat(shipping).toFixed(2),
    total:                total.toFixed(2),
    freeShipping:         isFree,
    amountToFreeShipping: Math.max(0, freeShippingThreshold - safeSubtotal).toFixed(2),
  }
}

export function formatGBP(amount) {
  const safeAmount = parseFloat(amount) || 0
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(safeAmount)
}

export function penceToGBP(pence) {
  return (pence / 100).toFixed(2)
}

export function gbpToPence(pounds) {
  return Math.round(parseFloat(pounds) * 100)
}
