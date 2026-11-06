// 商品编辑器的纯数据逻辑。放在单独文件里，页面组件只负责状态和布局。

export const optObj = o => (typeof o === 'object' && o !== null ? o : { value: o, image: '' })

// 加载时记下库存，保存时交给后端判断"库存是不是被改过"
export const loadSku = k => ({ ...k, attributes: k.attributes || {}, _loaded_stock_qty: k.stock_qty })

export function loadAttributeConfig(value) {
  return (value || []).map(a => ({ ...a, options: (a.options || []).map(optObj) }))
}

export function initialSpecifications(product, isNew) {
  return !isNew && Array.isArray(product.specifications) && product.specifications.length > 0
    ? product.specifications
    : [{ key: '', value: '' }]
}

export function buildCombos(attrConfig) {
  const valid = attrConfig.filter(a => a.name.trim() && a.options.some(o => optObj(o).value.trim()))
  return valid.reduce((acc, attr) => {
    const opts = attr.options.map(o => optObj(o).value).filter(o => o.trim())
    if (acc.length === 0) return opts.map(o => ({ [attr.name]: o }))
    const out = []
    for (const combo of acc) for (const opt of opts) out.push({ ...combo, [attr.name]: opt })
    return out
  }, [])
}

// 按选项生成 SKU：已有组合保留，新组合追加，不在新组合里的旧 SKU 记为待删除。
export function buildSkuRows(skus, combos) {
  const existing = {}
  skus.forEach(k => { existing[JSON.stringify(k.attributes || {})] = k })
  const next = combos.map(attrs => existing[JSON.stringify(attrs)] || {
    _temp_id: Date.now() + Math.random(),
    attributes: attrs,
    colour_hex: '#D4C5B0',
    price_gbp: '',
    stock_qty: 0,
    is_active: true,
  })
  const keys = new Set(combos.map(c => JSON.stringify(c)))
  const removedIds = skus
    .filter(k => k.id && !keys.has(JSON.stringify(k.attributes || {})))
    .map(k => k.id)
  return { next, removedIds }
}

export function createSku(attrConfig) {
  const attrs = {}
  attrConfig.forEach(a => { if (a.name.trim()) attrs[a.name] = '' })
  return {
    _temp_id: Date.now() + Math.random(),
    attributes: attrs,
    colour_hex: '#D4C5B0',
    price_gbp: '',
    stock_qty: 0,
    is_active: true,
  }
}

export function buildProductPayload({ isNew, product, form, images, attrConfig, specifications, skus, deletedSkuIds }) {
  const cleanConfig = attrConfig
    .filter(a => a.name.trim())
    .map(a => ({ name: a.name.trim(), options: a.options.filter(o => optObj(o).value.trim()).map(optObj) }))

  return {
    action: isNew ? 'create' : 'update',
    product: {
      ...(isNew ? {} : { id: product.id }),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      collection: form.collection,
      is_active: form.active,
      is_featured: form.featured || false,
      sort_order: parseInt(form.sort_order) || 0,
      images,
      attribute_config: cleanConfig,
      specifications: specifications.filter(x => x.key.trim() && x.value.trim()),
    },
    skus: skus.map(k => ({
      ...(k.id ? { id: k.id, loaded_stock_qty: k._loaded_stock_qty } : {}),
      attributes: k.attributes || {},
      colour: k.attributes?.['颜色'] || k.attributes?.['Colour'] || k.attributes?.['Color'] || k.colour || '默认',
      colour_hex: k.colour_hex || '#D4C5B0',
      width_mm: k.attributes?.['宽度'] ? parseInt(k.attributes['宽度']) : (k.attributes?.['Width'] ? parseInt(k.attributes['Width']) : k.width_mm || null),
      length_m: k.attributes?.['长度'] ? parseInt(k.attributes['长度']) : (k.attributes?.['Length'] ? parseInt(k.attributes['Length']) : k.length_m || null),
      price_gbp: k.price_gbp,
      stock_qty: k.stock_qty,
      is_active: k.is_active,
      images: k.images || [],
    })),
    deletedSkuIds,
  }
}
