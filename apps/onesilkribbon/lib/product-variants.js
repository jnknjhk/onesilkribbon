export const variantUrl = (url, sku) => `${url}?sku=${encodeURIComponent(sku.id)}`
export const validSkus = skus => (skus || []).filter(s => s.is_active !== false && Number.isFinite(Number(s.price_gbp)) && Number(s.price_gbp) > 0)
export function selectInitialSku(skus, requested) {
  return skus.find(s => s.id === requested) || skus[0] || null
}
export function skuAttributes(product, sku) {
  if (!sku) return {}
  if (Array.isArray(product?.attribute_config) && product.attribute_config.length) {
    return configuredAttributes(product, sku)
  }
  return {
    ...(sku.colour ? { Colour: String(sku.colour) } : {}),
    ...(sku.width_mm ? { Width: `${sku.width_mm}mm` } : {}),
    ...(sku.length_m ? { Length: `${sku.length_m}m` } : {}),
  }
}

function configuredAttributes(product, sku) {
  const saved = { ...(sku.attributes || {}) }
  const hasValue = value => ['string', 'number'].includes(typeof value) && String(value).trim() !== ''
  if (product.attribute_config.every(attribute => hasValue(saved[attribute.name]))) return saved
  // Older imports encoded configured values in the SKU code but omitted the
  // attributes object. Recover only a unique configured combination, allowing
  // whitespace differences such as the imported "5Yard" versus "5 Yard".
  if (!product.slug || typeof sku.sku_code !== 'string' || !sku.sku_code.startsWith(product.slug + '-')) return saved
  const code = sku.sku_code.replace(/\s+/g, '')
  let combinations = 1
  const groups = product.attribute_config.map(attribute => ({
    name: attribute.name,
    values: [...new Set((attribute.options || []).map(option =>
      option && typeof option === 'object' ? option.value : option,
    ).filter(hasValue).map(String))],
  }))
  for (const group of groups) {
    combinations *= group.values.length
    if (!group.values.length || combinations > 1000) return saved
  }
  const matches = []
  const find = (index, entries, values) => {
    if (matches.length > 1) return
    if (index === groups.length) {
      if (code === `${product.slug}-${values.join('-')}`.replace(/\s+/g, '')) matches.push(entries)
      return
    }
    const group = groups[index]
    for (const value of group.values) {
      if (hasValue(saved[group.name]) && String(saved[group.name]) !== value) continue
      find(index + 1, [...entries, [group.name, value]], [...values, value])
    }
  }
  find(0, [], [])
  return matches.length === 1
    ? { ...saved, ...Object.fromEntries(matches[0].filter(([name]) => !hasValue(saved[name]))) }
    : saved
}
export function matchSku(product, skus, attrs, current) {
  const matches = skus.filter(s => {
    const values = skuAttributes(product, s)
    return Object.entries(attrs).every(([key, value]) => !value || values[key] === value)
  })
  return matches.find(s => s.id === current?.id) || matches[0] || null
}
export function merchantVariantAttributes(product, sku) {
  const clean = value => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
    return /^(默认|default)$/i.test(text) ? '' : text
  }
  const attributes = Object.entries(skuAttributes(product, sku))
  const valueFor = names => clean(attributes.find(([name, value]) => names.includes(name.trim().toLowerCase()) && clean(value))?.[1])
  // Custom attributes are what customers select on the product page. Older
  // imported SKUs can have COLOR/WIDTH there while the legacy columns are empty.
  const legacyColour = clean(sku.colour)
  const legacyColourIsDimension = attributes.some(([name, value]) =>
    ['width', 'length', 'size', '宽度', '长度', '尺寸'].includes(name.trim().toLowerCase()) && clean(value) === legacyColour,
  )
  const color = valueFor(['color', 'colour', '颜色']) || (legacyColourIsDimension ? '' : legacyColour)
  const width = valueFor(['width', '宽度']) || (Number(sku.width_mm) > 0 ? `${sku.width_mm}mm` : '')
  const length = valueFor(['length', '长度']) || (Number(sku.length_m) > 0 ? `${sku.length_m}m` : '')
  const size = valueFor(['size', '尺寸', '尺码']) || [width, length].filter(Boolean).join(' × ')
  return { ...(color ? { color } : {}), ...(size ? { size } : {}) }
}
export function skuLabel(sku, product = {}) {
  return Object.values(merchantVariantAttributes(product, sku)).join(', ')
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
  const attributes = variants.map(sku => merchantVariantAttributes(product, sku))
  const description = String(product.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const excerpt = description.length > 240 ? description.slice(0, 240).replace(/\s+\S*$/, '').trim() : description
  const variesBy = ['color', 'size'].filter(key =>
    attributes.length > 1 && attributes.every(value => value[key]) && new Set(attributes.map(value => value[key])).size > 1
  ).map(key => `https://schema.org/${key}`)
  return {
    '@context': 'https://schema.org', '@type': 'ProductGroup', '@id': url + '#product-group',
    name: product.name, description,
    url, productGroupID: product.id, brand: { '@type': 'Brand', name: 'One Silk Ribbon' },
    image: Array.isArray(product.images) ? product.images : [],
    ...(variesBy.length ? { variesBy } : {}),
    hasVariant: variants.map((s, index) => {
      const image = variantImage(product, s)
      const name = [product.name, skuLabel(s, product)].filter(Boolean).join(' — ')
      return {
        '@type': 'Product', '@id': variantUrl(url, s) + '#product',
        name, description: [name, excerpt].filter(Boolean).join('. '),
        sku: s.sku_code || s.id, ...(s.sku_code ? { mpn: s.sku_code } : {}),
        ...attributes[index],
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
