// UK VAT rate
export const UK_VAT_RATE = 0.20

// Free shipping threshold
export const FREE_SHIPPING_THRESHOLD = 45.00
export const SHIPPING_RATE = 3.95

/**
 * Calculate order totals with UK VAT
 * Prices stored ex-VAT, displayed inc-VAT to UK customers
 */
export function calculateTotals(subtotalExVat) {
  // 修复点：增加防御性代码，确保 subtotalExVat 是有效的数字
  const safeSubtotal = parseFloat(subtotalExVat) || 0;
  
  const vatAmount  = parseFloat((safeSubtotal * UK_VAT_RATE).toFixed(2))
  const subtotalIncVat = parseFloat((safeSubtotal + vatAmount).toFixed(2))
  const shipping   = subtotalIncVat >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATE
  const total      = parseFloat((subtotalIncVat + shipping).toFixed(2))

  return {
    subtotalExVat:  safeSubtotal.toFixed(2),
    vatAmount:      vatAmount.toFixed(2),
    subtotalIncVat: subtotalIncVat.toFixed(2),
    shipping:       shipping.toFixed(2),
    total:          total.toFixed(2),
    freeShipping:   shipping === 0,
    amountToFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalIncVat).toFixed(2),
  }
}

export function formatGBP(amount) {
  const safeAmount = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(safeAmount)
}

// Convert pence to pounds
export function penceToGBP(pence) {
  return (pence / 100).toFixed(2)
}

// Convert pounds to pence (for Stripe)
export function gbpToPence(pounds) {
  return Math.round(parseFloat(pounds) * 100)
}
