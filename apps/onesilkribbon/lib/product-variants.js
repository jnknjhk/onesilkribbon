export const variantUrl = (url, sku) => `${url}?sku=${encodeURIComponent(sku.id)}`
export const validSkus = skus => (skus || []).filter(s => s.is_active !== false && Number.isFinite(Number(s.price_gbp)) && Number(s.price_gbp) > 0)
export function selectInitialSku(skus, requested) {
  return skus.find(s => s.id === requested) || skus[0] || null
}
export function skuAttributes(product, sku) {
  if (!sku) return {}
  if (Array.isArray(product?.attribute_config) && product.attribute_config.length) return { ...(sku.attributes || {}) }
  return {
    ...(sku.colour ? { Colour: String(sku.colour) } : {}),
    ...(sku.width_mm ? { Width: `${sku.width_mm}mm` } : {}),
    ...(sku.length_m ? { Length: `${sku.length_m}m` } : {}),
  }
}
export function matchSku(product, skus, attrs, current) {
  const matches = skus.filter(s => {
    const values = skuAttributes(product, s)
    return Object.entries(attrs).every(([key, value]) => !value || values[key] === value)
  })
  return matches.find(s => s.id === current?.id) || matches[0] || null
}
export function skuLabel(sku) {
  return [sku.colour && sku.colour !== '默认' ? sku.colour : '', sku.width_mm ? `${sku.width_mm}mm` : '', sku.length_m ? `${sku.length_m}m` : ''].filter(Boolean).join(', ')
}
export function variantImage(product, sku) {
  const firstImage = images => Array.isArray(images) ? images.find(image => typeof image === 'string' && image.trim()) : null
  const skuImage = firstImage(sku.images)
  if (skuImage) return skuImage
  const attributes = skuAttributes(product, sku)
  for (const attribute of product.attribute_config || []) {
    const option = (attribute.options || []).find(value => value && typeof value === 'object' && value.value === attributes[attribute.name])
    if (typeof option?.image === 'string' && option.image.trim()) return option.image
  }
  return firstImage(product.images) || null
}
export function productGroupSchema(product, skus, url, shippingDetails, returnPolicy) {
  const variants = validSkus(skus)
  return {
    '@context': 'https://schema.org', '@type': 'ProductGroup', '@id': url + '#product-group',
    name: product.name, description: String(product.description || '').replace(/<[^>]*>/g, ''),
    url, productGroupID: product.id, brand: { '@type': 'Brand', name: 'One Silk Ribbon' },
    image: Array.isArray(product.images) ? product.images : [],
    variesBy: ['https://schema.org/color', 'https://schema.org/size'],
    hasVariant: variants.map(s => {
      const size = [s.width_mm ? `${s.width_mm}mm` : '', s.length_m ? `${s.length_m}m` : ''].filter(Boolean).join(' × ')
      const image = variantImage(product, s)
      return {
        '@type': 'Product', '@id': variantUrl(url, s) + '#product',
        name: [product.name, skuLabel(s)].filter(Boolean).join(' — '),
        sku: s.sku_code || s.id, ...(s.sku_code ? { mpn: s.sku_code } : {}),
        ...(s.colour && s.colour !== '默认' ? { color: s.colour } : {}), ...(size ? { size } : {}),
        // A representative variant image is sufficient here. Repeating a
        // 31-photo gallery for every size/colour makes the HTML much larger;
        // the full gallery remains on the group and in the product UI.
        image: image ? [image] : [],
        offers: {
          '@type': 'Offer', url: variantUrl(url, s), priceCurrency: 'GBP', price: Number(s.price_gbp).toFixed(2),
          availability: Number(s.stock_qty) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: 'One Silk Ribbon', url: 'https://onesilkribbon.com' },
          shippingDetails, hasMerchantReturnPolicy: returnPolicy,
        },
      }
    }),
  }
}
