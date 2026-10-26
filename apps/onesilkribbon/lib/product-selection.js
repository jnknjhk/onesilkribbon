import { skuAttributes } from '@/lib/product-variants'

export function productOptionGroups(product, skus = []) {
  if (Array.isArray(product?.attribute_config) && product.attribute_config.length) {
    return product.attribute_config.map(attribute => ({ name: attribute.name, options: attribute.options || [] }))
  }
  const groups = []
  const colours = [...new Set(skus.map(s => s.colour).filter(Boolean))]
  const widths = [...new Set(skus.map(s => s.width_mm).filter(Boolean))]
  const lengths = [...new Set(skus.map(s => s.length_m).filter(Boolean))]
  if (colours.length > 1) groups.push({ name: 'Colour', options: colours })
  if (widths.length > 1) groups.push({ name: 'Width', options: widths.map(width => `${width}mm`) })
  if (lengths.length > 1) groups.push({ name: 'Length', options: lengths.map(length => `${length}m`) })
  return groups
}

export function selectionIsComplete(groups, attributes) {
  return groups.every(group => {
    const selected = attributes[group.name]
    return selected !== undefined && selected !== null && String(selected).trim() !== '' &&
      group.options.some(option => String(option && typeof option === 'object' ? option.value : option) === String(selected))
  })
}

export function selectedOptionRows(product, sku) {
  const labels = { color: 'Colour', colour: 'Colour', width: 'Width', length: 'Length', size: 'Size' }
  return Object.entries(skuAttributes(product, sku)).flatMap(([name, value]) => {
    if (!['string', 'number'].includes(typeof value)) return []
    const text = String(value).trim()
    if (!text || /^(default|默认)$/i.test(text)) return []
    return [{ label: labels[name.trim().toLowerCase()] || name, value: text }]
  })
}
