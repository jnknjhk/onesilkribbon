import { hasConsented } from '@/lib/consent'
import { gbpToPence } from '@/lib/pricing'
import { merchantVariantAttributes } from '@/lib/product-variants'

export const GA_ID = 'G-D48ERTWL0R'
const pending = []

export function isPrivateAnalyticsPath(pathname) {
  return ['/admin', '/admin-login', '/account', '/auth', '/login', '/checkout', '/order-confirmed', '/track-order', '/api']
    .some(path => pathname === path || pathname.startsWith(path + '/'))
}

function canTrackProduct() {
  return typeof window !== 'undefined' && hasConsented() &&
    window.location.origin === 'https://onesilkribbon.com' &&
    /^\/collections\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(window.location.pathname) &&
    !isPrivateAnalyticsPath(window.location.pathname)
}

export function flushProductEvents() {
  try {
    if (!canTrackProduct()) { pending.length = 0; return }
    // Never carry an event to a different page or replay it after a private flow.
    const pathname = window.location.pathname
    for (let index = pending.length - 1; index >= 0; index--) {
      if (pending[index].pathname !== pathname) pending.splice(index, 1)
    }
    if (window[`ga-disable-${GA_ID}`] || typeof window.gtag !== 'function') return
    while (pending.length) {
      const event = pending[0]
      window.gtag('event', event.name, event.params)
      pending.shift()
    }
  } catch { /* Analytics must never interrupt shopping. */ }
}

export function trackProductEvent(name, product, sku, quantity = 1) {
  try {
    if (!['view_item', 'add_to_cart'].includes(name) || !canTrackProduct()) return false
    if (!product?.id || !sku?.id || sku.is_active === false || !Number.isSafeInteger(quantity) || quantity < 1) return false
    const price = gbpToPence(sku.price_gbp)
    const value = price * quantity
    if (price <= 0 || !Number.isSafeInteger(value)) return false
    const text = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 200) : ''
    const itemId = text(sku.sku_code) || text(sku.id)
    const itemName = text(product.name)
    if (!itemId || !itemName) return false
    const variant = merchantVariantAttributes(product, sku)
    const pathname = window.location.pathname
    // Only public catalog fields enter the event; URLs never include query data.
    const params = {
      send_to: GA_ID, currency: 'GBP', value: value / 100,
      page_location: `https://onesilkribbon.com${pathname}`,
      page_referrer: '', page_title: itemName,
      items: [{
        item_id: itemId, item_name: itemName, item_brand: 'One Silk Ribbon',
        item_category: text(product.collection),
        item_variant: text(Object.values(variant).join(', ')),
        price: price / 100, quantity,
      }],
    }
    if (pending.length >= 20) pending.shift()
    pending.push({ name, pathname, params })
    flushProductEvents()
    return true
  } catch { return false }
}
