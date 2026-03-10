// UK VAT rate
export const UK_VAT_RATE = 0.20

// 默认兜底值
export const FREE_SHIPPING_THRESHOLD = 45.00
export const SHIPPING_RATE = 3.95

/**
 * Calculate order totals with UK VAT
 * shippingSettings 从数据库读取，传入时使用DB值，不传时使用默认值
 */
export function calculateTotals(subtotalExVat, shippingSettings) {
  const safeSubtotal = parseFloat(subtotalExVat) || 0

  const shippingRate          = shippingSettings?.shippingRate          ?? SHIPPING_RATE
  const freeShippingThreshold = shippingSettings?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD
  const freeShippingEnabled   = shippingSettings?.freeShippingEnabled   ?? true

  const vatAmount      = parseFloat((safeSubtotal * UK_VAT_RATE).toFixed(2))
  const subtotalIncVat = parseFloat((safeSubtotal + vatAmount).toFixed(2))
  const isFree         = freeShippingEnabled && subtotalIncVat >= freeShippingThreshold
  const shipping       = isFree ? 0 : shippingRate
  const total          = parseFloat((subtotalIncVat + shipping).toFixed(2))

  return {
    subtotalExVat:        safeSubtotal.toFixed(2),
    vatAmount:            vatAmount.toFixed(2),
    subtotalIncVat:       subtotalIncVat.toFixed(2),
    shipping:             parseFloat(shipping).toFixed(2),
    total:                total.toFixed(2),
    freeShipping:         isFree,
    amountToFreeShipping: Math.max(0, freeShippingThreshold - subtotalIncVat).toFixed(2),
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
