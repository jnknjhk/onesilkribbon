// UK VAT rate
export const UK_VAT_RATE = 0.20

// 默认运费（当数据库读取失败时的兜底值）
export const DEFAULT_SHIPPING_RATE = 3.95
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 45.00

/**
 * 从 Supabase 读取运费设置
 * 供 API route / server component 使用
 */
export async function getShippingSettings() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])

    if (!data) return { shippingRate: DEFAULT_SHIPPING_RATE, freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, freeShippingEnabled: true }

    const map = Object.fromEntries(data.map(r => [r.key, r.value]))
    return {
      shippingRate:           parseFloat(map.shipping_rate)           || DEFAULT_SHIPPING_RATE,
      freeShippingThreshold:  parseFloat(map.free_shipping_threshold) || DEFAULT_FREE_SHIPPING_THRESHOLD,
      freeShippingEnabled:    map.free_shipping_enabled !== 'false',
    }
  } catch {
    return { shippingRate: DEFAULT_SHIPPING_RATE, freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, freeShippingEnabled: true }
  }
}

/**
 * 客户端用：传入运费设置计算订单总额
 */
export function calculateTotals(subtotalExVat, shippingSettings) {
  const safeSubtotal = parseFloat(subtotalExVat) || 0
  const { shippingRate = DEFAULT_SHIPPING_RATE, freeShippingThreshold = DEFAULT_FREE_SHIPPING_THRESHOLD, freeShippingEnabled = true } = shippingSettings || {}

  const vatAmount      = parseFloat((safeSubtotal * UK_VAT_RATE).toFixed(2))
  const subtotalIncVat = parseFloat((safeSubtotal + vatAmount).toFixed(2))

  const isFreeShipping = freeShippingEnabled && subtotalIncVat >= freeShippingThreshold
  const shipping       = isFreeShipping ? 0 : shippingRate
  const total          = parseFloat((subtotalIncVat + shipping).toFixed(2))

  return {
    subtotalExVat:        safeSubtotal.toFixed(2),
    vatAmount:            vatAmount.toFixed(2),
    subtotalIncVat:       subtotalIncVat.toFixed(2),
    shipping:             shipping.toFixed(2),
    total:                total.toFixed(2),
    freeShipping:         isFreeShipping,
    amountToFreeShipping: Math.max(0, freeShippingThreshold - subtotalIncVat).toFixed(2),
  }
}

/**
 * 格式化为英镑显示
 */
export function formatGBP(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount || 0)
}
