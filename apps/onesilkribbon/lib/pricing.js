// 默认兜底值
export const FREE_SHIPPING_THRESHOLD = 45.00
export const SHIPPING_RATE = 3.95

/**
 * 计算订单总额
 * 商品标价已含税（VAT included in price），结算时只加运费
 * shippingSettings 从数据库读取
 */
export function calculateTotals(subtotal, shippingSettings, discount = 0) {
  const gross = gbpToPence(subtotal)
  const net = Math.max(0, gross - Math.max(0, gbpToPence(discount)))

  const shippingRate          = shippingSettings?.shippingRate          ?? SHIPPING_RATE
  const freeShippingThreshold = shippingSettings?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD
  const freeShippingEnabled   = shippingSettings?.freeShippingEnabled   ?? true

  const threshold = gbpToPence(freeShippingThreshold)
  const isFree = freeShippingEnabled && net >= threshold
  const shipping = isFree ? 0 : gbpToPence(shippingRate)
  const total = net + shipping

  return {
    subtotal:             penceToGBP(gross),
    shipping:             penceToGBP(shipping),
    total:                penceToGBP(total),
    freeShipping:         isFree,
    amountToFreeShipping: penceToGBP(Math.max(0, threshold - net)),
  }
}

export function formatGBP(amount) {
  const safeAmount = gbpToPence(amount) / 100
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(safeAmount)
}

export function penceToGBP(pence) {
  if (!Number.isSafeInteger(pence)) throw new TypeError('Invalid money')
  const value = BigInt(pence)
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

export function gbpToPence(pounds) {
  const { numerator, denominator } = decimalRatio(pounds)
  return roundedRatio(numerator * 100n, denominator)
}

function decimalRatio(value) {
  if (!['string', 'number'].includes(typeof value)) throw new TypeError('Invalid decimal')
  const text = String(value)
  if (text.length > 100 || !/^-?\d+(?:\.\d+)?$/.test(text)) throw new TypeError('Invalid decimal')
  const [whole, fraction = ''] = text.split('.')
  return { numerator: BigInt(whole + fraction), denominator: 10n ** BigInt(fraction.length) }
}

function roundedRatio(numerator, denominator) {
  const sign = numerator < 0n ? -1n : 1n
  const absolute = numerator * sign
  const result = Number(sign * ((absolute + denominator / 2n) / denominator))
  if (!Number.isSafeInteger(result)) throw new RangeError('Money out of range')
  return result
}

export function cartSubtotalPence(items) {
  // Sum exact database decimals before rounding, as PostgreSQL numeric does.
  let numerator = 0n
  let denominator = 1n
  for (const item of items) {
    const price = decimalRatio(item.price)
    numerator = numerator * price.denominator + price.numerator * BigInt(item.qty) * denominator
    denominator *= price.denominator
  }
  return roundedRatio(numerator * 100n, denominator)
}

export function couponDiscountPence(coupon, subtotal) {
  const value = decimalRatio(coupon.discount_value)
  if (value.numerator < 0n || !['percentage', 'fixed'].includes(coupon.discount_type)) throw new TypeError('Invalid coupon')
  const amount = coupon.discount_type === 'percentage'
    ? roundedRatio(BigInt(subtotal) * value.numerator, value.denominator * 100n)
    : gbpToPence(coupon.discount_value)
  return Math.max(0, Math.min(amount, subtotal - 30))
}
