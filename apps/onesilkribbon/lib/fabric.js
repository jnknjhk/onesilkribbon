// Silk fabric by the metre.
//
// A fabric product is one cloth (type + weight). Its SKUs are the colours.
// `price_gbp` is the price per metre, `stock_qty` is metres in stock, and the
// product specification `Max continuous cut` is the longest single cut. This
// keeps the existing product/SKU tables and cart format unchanged.
export const FABRIC_COLLECTION = 'silk-fabric'

export const FABRIC_SPEC_KEYS = {
  type: 'Fabric type',
  weight: 'Weight',
  width: 'Width',
  use: 'Use',
  maxCut: 'Max continuous cut',
  weave: 'Weave',
  sheer: 'Sheer',
  drape: 'Drape',
  lustre: 'Lustre',
}

// Shared weight grouping for the browse filters. The medium range is inclusive
// at both ends, so every positive momme value has exactly one group:
//   Lightweight: < 12 momme
//   Medium:      12–20 momme
//   Heavier:     > 20 momme
// Missing or invalid weight values get no group and are never auto-classified.
export const FABRIC_WEIGHT_GROUPS = [
  {
    id: 'lightweight',
    label: 'Lightweight',
    range: 'Under 12 momme',
    maxExclusive: 12,
    note: 'Sheer, airy and best layered.',
  },
  {
    id: 'medium',
    label: 'Medium',
    range: '12–20 momme',
    minInclusive: 12,
    maxInclusive: 20,
    note: 'The everyday range: opaque enough for a blouse, fluid enough for a dress.',
  },
  {
    id: 'heavier',
    label: 'Heavier',
    range: 'Over 20 momme',
    minExclusive: 20,
    note: 'A fuller, more sculptural satin for bridal, tailoring and home.',
  },
]

const SPEC_ALIASES = {
  type: ['fabric type', 'type', 'cloth', '面料类型', '品类'],
  weight: ['weight', 'momme', '重量'],
  width: ['width', '幅宽', '宽度'],
  use: ['use', 'uses', 'project', 'projects', '用途'],
  maxCut: ['max continuous cut', 'maximum continuous cut', 'continuous cut', 'max cut', '连续裁剪', '最大连续裁剪'],
  weave: ['weave', '织法'],
  sheer: ['sheer', '透光度'],
  drape: ['drape', '垂坠'],
  lustre: ['lustre', 'luster', '光泽'],
}

const normalizeKey = value => String(value || '')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[：:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const cleanText = value => typeof value === 'string' || typeof value === 'number'
  ? String(value).trim()
  : ''

export function isFabricCollection(collection) {
  return collection === FABRIC_COLLECTION
}

export function specificationEntries(product) {
  const raw = product?.specifications
  if (Array.isArray(raw)) {
    return raw.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const key = cleanText(item.key)
      const value = cleanText(item.value)
      return key ? [{ key, value }] : []
    })
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).flatMap(([key, value]) => {
      const text = cleanText(value)
      return key && text ? [{ key, value: text }] : []
    })
  }
  return []
}

export function specificationValue(product, aliases) {
  const wanted = new Set((aliases || []).map(normalizeKey))
  const found = specificationEntries(product).find(entry => wanted.has(normalizeKey(entry.key)))
  return found?.value || ''
}

export function fabricType(product) {
  return specificationValue(product, SPEC_ALIASES.type) || 'Silk fabric'
}

export function fabricWeight(product) {
  return specificationValue(product, SPEC_ALIASES.weight) || ''
}

// Strict momme parser: a positive number with an optional "momme" / "姆米"
// unit. Ranges, approximations and unrelated units are invalid.
export function parseFabricMomme(value) {
  const text = cleanText(value)
  if (!text) return null
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(?:momme|姆米)?$/i)
  if (!match) return null
  const momme = Number(match[1])
  return Number.isFinite(momme) && momme > 0 ? momme : null
}

export function fabricMomme(product) {
  return parseFabricMomme(fabricWeight(product))
}

export function fabricWeightGroup(momme) {
  const value = momme
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return FABRIC_WEIGHT_GROUPS.find(group => {
    if (group.maxExclusive != null && value < group.maxExclusive) return true
    if (group.minInclusive != null && value >= group.minInclusive && value <= group.maxInclusive) return true
    if (group.minExclusive != null && value > group.minExclusive) return true
    return false
  }) || null
}

export function fabricWidth(product) {
  return specificationValue(product, SPEC_ALIASES.width) || ''
}

export function fabricWeave(product) {
  return specificationValue(product, SPEC_ALIASES.weave) || ''
}

export function fabricUses(product) {
  const raw = specificationValue(product, SPEC_ALIASES.use)
  if (!raw) return []
  const seen = new Set()
  return raw
    .split(/[,;|·/]+/)
    .map(item => item.trim())
    .filter(item => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// Strict maximum continuous cut parser. The entire input must be a positive
// integer metres value: "5" or "5 m" / "5 metres" / "5 米". Negative numbers,
// zero, decimals, ranges, centimetres, yards, approximations and mixed text are
// rejected rather than extracting a number from the middle.
export function parseFabricMaxCut(value) {
  const text = cleanText(value)
  if (!text) return null
  const match = text.match(/^(\d+)\s*(?:m|meter|meters|metre|metres|米)?$/i)
  if (!match) return null
  const metres = Number(match[1])
  return Number.isSafeInteger(metres) && metres > 0 ? metres : null
}

export function fabricMaxCutM(product) {
  return parseFabricMaxCut(specificationValue(product, SPEC_ALIASES.maxCut))
}

const explicitColour = sku => {
  const direct = cleanText(sku?.colour)
  if (direct && !/^(默认|default)$/i.test(direct)) return direct
  const attributes = sku?.attributes && typeof sku.attributes === 'object' ? sku.attributes : {}
  for (const key of ['Colour', 'Color', '颜色']) {
    const value = cleanText(attributes[key])
    if (value && !/^(默认|default)$/i.test(value)) return value
  }
  return ''
}

const colourName = sku => explicitColour(sku) || 'Natural'

export const fabricSkuColour = sku => explicitColour(sku)

// Same-price SKUs come back from the database in physical row order, which for
// a large colour range can start in the middle. Show the merchant's configured
// colour order instead, falling back to a natural sort for unlisted colours.
export function orderFabricSkus(product, skus = []) {
  const configured = (Array.isArray(product?.attribute_config) ? product.attribute_config : [])
    .find(attribute => /^(colou?r|颜色)$/i.test(cleanText(attribute?.name)))
  const optionOrder = new Map()
  if (Array.isArray(configured?.options)) {
    configured.options.forEach((option, index) => {
      const value = cleanText(option && typeof option === 'object' ? option.value : option)
      if (value && !optionOrder.has(value)) optionOrder.set(value, index)
    })
  }
  return (Array.isArray(skus) ? skus : [])
    .map((sku, index) => ({ sku, index, name: colourName(sku) }))
    .sort((a, b) => {
      const aOrder = optionOrder.has(a.name) ? optionOrder.get(a.name) : Number.POSITIVE_INFINITY
      const bOrder = optionOrder.has(b.name) ? optionOrder.get(b.name) : Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name, undefined, { numeric: true }) || a.index - b.index
    })
    .map(entry => entry.sku)
}

const isBlank = value => value === null || value === undefined ||
  (typeof value === 'string' && value.trim() === '')

// A fabric draft may omit a price or stock value. The database columns are
// required, so a missing draft value is stored as zero; publishing still
// requires at least one active colour with a positive per-metre price.
export function normalizeFabricDraftSkus(skus = []) {
  return (skus || []).map(sku => {
    if (!sku || typeof sku !== 'object' || Array.isArray(sku)) return sku
    return {
      ...sku,
      ...(isBlank(sku.price_gbp) ? { price_gbp: 0 } : {}),
      ...(isBlank(sku.stock_qty) ? { stock_qty: 0 } : {}),
    }
  })
}

export function fabricPublishErrors(product, skus = []) {
  const errors = []
  // Use the stored specification, not fabricType()'s display fallback.
  if (!specificationValue(product, SPEC_ALIASES.type)) {
    errors.push('面料品类 Fabric type（例如 Silk Chiffon、Silk Charmeuse 或 Crêpe de Chine）')
  }
  if (!fabricWeave(product)) errors.push('织法 Weave')
  if (fabricMomme(product) === null) errors.push('姆米 Weight（例如 19 momme）')
  if (!fabricWidth(product)) errors.push('门幅 Width')
  if (!fabricUses(product).length) errors.push('用途 Use')
  if (fabricMaxCutM(product) === null) {
    errors.push('最大连续裁剪 Max continuous cut（正整数米，例如 5 或 5 m）')
  }
  const hasSellableSku = (skus || []).some(sku => {
    if (!sku || sku.is_active === false) return false
    const price = Number(sku.price_gbp)
    return Boolean(explicitColour(sku)) && Number.isFinite(price) && price > 0
  })
  if (!hasSellableSku) errors.push('至少一个启用的颜色 SKU，并填写有效每米价')
  return errors
}

const colourHex = value => /^#[0-9a-f]{6}$/i.test(cleanText(value)) ? cleanText(value) : '#D4C5B0'

export function fabricView(product, skus = []) {
  const activeSkus = (skus || []).filter(sku =>
    sku && sku.is_active !== false && Number.isFinite(Number(sku.price_gbp)) && Number(sku.price_gbp) > 0
  )
  const colours = []
  const seen = new Set()
  for (const sku of activeSkus) {
    const name = colourName(sku)
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    colours.push({
      skuId: sku.id,
      name,
      hex: colourHex(sku.colour_hex),
      price: Number(sku.price_gbp),
      stock: Number.isSafeInteger(Number(sku.stock_qty)) ? Number(sku.stock_qty) : 0,
      image: Array.isArray(sku.images) ? sku.images.find(Boolean) || null : null,
    })
  }

  const prices = colours.map(colour => colour.price).filter(price => price > 0)
  const stockTotal = colours.reduce((total, colour) => total + colour.stock, 0)
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : []
  const momme = fabricMomme(product)

  return {
    ...product,
    fabric: {
      type: fabricType(product),
      weight: fabricWeight(product),
      momme,
      weightGroup: fabricWeightGroup(momme),
      width: fabricWidth(product),
      weave: fabricWeave(product),
      uses: fabricUses(product),
      maxCutM: fabricMaxCutM(product),
      priceFrom: prices.length ? Math.min(...prices) : 0,
      stockTotal,
      colours,
      image: images[0] || null,
      images,
    },
  }
}

export function fabricQuantityLimit(stock, maxCutM) {
  const available = Number(stock)
  if (!Number.isSafeInteger(available) || available < 1) return 0
  if (!Number.isSafeInteger(maxCutM) || maxCutM < 1) return 0
  return Math.min(available, maxCutM)
}

export function fabricQuantityError(product, sku, qty) {
  if (!isFabricCollection(product?.collection)) return null
  const metres = Number(qty)
  if (!Number.isSafeInteger(metres) || metres < 1) return 'Choose a whole number of metres'
  const maxCut = fabricMaxCutM(product)
  if (!maxCut) return 'The maximum continuous cut is not configured for this fabric'
  if (metres > maxCut) return `The longest continuous cut is ${maxCut} m`
  const stock = Number(sku?.stock_qty)
  if (!Number.isSafeInteger(stock) || stock < metres) {
    return `Only ${Number.isSafeInteger(stock) ? stock : 0} m left in stock`
  }
  return null
}

export function fabricSkuDescription(product, sku) {
  const width = fabricWidth(product)
  return [
    colourName(sku),
    width ? `${width} wide` : '',
    'sold by the metre',
  ].filter(Boolean).join(' · ')
}

export function fabricFilterSlug(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'other'
}

export function buildFabricFilters(products = []) {
  const types = new Map()
  const uses = new Map()
  const weights = new Map(FABRIC_WEIGHT_GROUPS.map(group => [group.id, {
    id: group.id,
    label: group.label,
    range: group.range,
    note: group.note,
    count: 0,
    image: null,
  }]))
  const colours = new Map()

  for (const product of products) {
    const fabric = product.fabric
    if (!fabric) continue

    const typeId = fabricFilterSlug(fabric.type)
    const type = types.get(typeId) || { id: typeId, label: fabric.type, count: 0, image: fabric.image }
    type.count += 1
    if (!type.image && fabric.image) type.image = fabric.image
    types.set(typeId, type)

    for (const use of fabric.uses) {
      const useId = fabricFilterSlug(use)
      const entry = uses.get(useId) || { id: useId, label: use, count: 0 }
      entry.count += 1
      uses.set(useId, entry)
    }

    if (fabric.weightGroup) {
      const entry = weights.get(fabric.weightGroup.id)
      if (entry) {
        entry.count += 1
        if (!entry.image && fabric.image) entry.image = fabric.image
      }
    }

    for (const colour of fabric.colours) {
      const colourId = fabricFilterSlug(colour.name)
      const entry = colours.get(colourId) || { id: colourId, label: colour.name, hex: colour.hex, count: 0 }
      entry.count += 1
      colours.set(colourId, entry)
    }
  }

  return {
    types: [...types.values()].sort((a, b) => a.label.localeCompare(b.label)),
    uses: [...uses.values()].sort((a, b) => a.label.localeCompare(b.label)),
    weights: [...weights.values()],
    colours: [...colours.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
  }
}

export function filterFabricProducts(products = [], filters = {}) {
  return products.filter(product => {
    const fabric = product.fabric
    if (!fabric) return false
    if (filters.type && fabricFilterSlug(fabric.type) !== filters.type) return false
    if (filters.use && !fabric.uses.some(use => fabricFilterSlug(use) === filters.use)) return false
    if (filters.weight && fabric.weightGroup?.id !== filters.weight) return false
    if (filters.colour && !fabric.colours.some(colour => fabricFilterSlug(colour.name) === filters.colour)) return false
    return true
  })
}

export function fabricDraftTemplate() {
  return {
    collection: FABRIC_COLLECTION,
    active: false,
    attributeConfig: [{ name: 'Colour', options: [{ value: '', image: '' }] }],
    specifications: [
      { key: FABRIC_SPEC_KEYS.type, value: '' },
      { key: FABRIC_SPEC_KEYS.weight, value: '' },
      { key: FABRIC_SPEC_KEYS.width, value: '' },
      { key: FABRIC_SPEC_KEYS.use, value: '' },
      { key: FABRIC_SPEC_KEYS.maxCut, value: '' },
      { key: FABRIC_SPEC_KEYS.weave, value: '' },
    ],
  }
}

export function fabricSpecRows(product) {
  const rows = [
    ['Fabric type', fabricType(product)],
    ['Weight', fabricWeight(product)],
    ['Width', fabricWidth(product)],
    ['Weave', fabricWeave(product)],
    ['Use', fabricUses(product).join(' · ')],
    ['Max continuous cut', fabricMaxCutM(product) ? `${fabricMaxCutM(product)} m` : ''],
  ]
  return rows.filter(([, value]) => value)
}
