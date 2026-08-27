import { supabaseAdmin } from '@osr/core/lib/supabase'
import { site } from '@/config/site'

// Google Merchant Center 商品数据源（RSS 2.0 / Google Shopping XML）。
// Google 每天会来抓取这个接口一次左右，不需要每次请求都是全新数据，
// 用 ISR 缓存一小时，避免每次抓取都全量查库。
export const revalidate = 3600

const SITE_URL = site.url
const BRAND    = site.name
const CURRENCY = site.currency

// 商品变体（SKU）粒度是 Google Shopping 的最小单位——同一个产品下不同颜色/尺寸，
// 价格、库存、图片都可能不一样，必须各自作为独立的 <item> 提交，靠 g:item_group_id
// 把它们重新分组显示成"一个商品、多个规格"。如果只按产品维度提交一条，
// 库存/价格没法精确到每个变体，也不符合 Google 的多规格商品数据规范。
function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripHtml(html) {
  return String(html ?? '').replace(/<[^>]+>/g, '').trim()
}

// SKU 的可读描述后缀（如 " - Champagne Gold, 7mm, 10m"）。
// 只用 colour / width_mm / length_m 这几个干净的结构化字段拼——
// SKU 上还有一个自由格式的 attributes JSON（后台批量导入时随手填的，
// 比如 { SISE: '1.5CM', COLOR: '2##' }），这些内部编码/拼音缩写不适合直接
// 展示给 Google Shopping 的公开买家，所以不采用。
function skuVariantSuffix(sku) {
  const parts = []
  if (sku.colour && sku.colour !== '默认') parts.push(sku.colour)
  if (sku.width_mm) parts.push(`${sku.width_mm}mm`)
  if (sku.length_m) parts.push(`${sku.length_m}m`)
  return parts.length > 0 ? ` - ${parts.join(', ')}` : ''
}

function buildItemXml({ product, sku }) {
  const image = (sku.images && sku.images[0]) || (product.images && product.images[0])
  if (!image) return '' // 没有图片的变体，Google 一定会拒收，不如干脆不提交这一条

  const link = `${SITE_URL}/collections/${product.collection}/${product.slug}`
  const title = `${product.name}${skuVariantSuffix(sku)}`
  const description = stripHtml(product.description).slice(0, 5000)
  const availability = (sku.stock_qty || 0) > 0 ? 'in_stock' : 'out_of_stock'
  const price = `${Number(sku.price_gbp || 0).toFixed(2)} ${CURRENCY}`

  const fields = [
    ['g:id', sku.sku_code],
    ['g:item_group_id', product.id],
    ['title', title],
    ['g:description', description],
    ['link', link],
    ['g:image_link', image],
    ['g:availability', availability],
    ['g:price', price],
    ['g:brand', BRAND],
    ['g:condition', 'new'],
    ['g:mpn', sku.sku_code],
  ]
  if (sku.colour && sku.colour !== '默认') fields.push(['g:color', sku.colour])

  const fieldsXml = fields
    .map(([tag, value]) => `      <${tag}>${xmlEscape(value)}</${tag}>`)
    .join('\n')

  return `    <item>\n${fieldsXml}\n    </item>`
}

export async function GET() {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, description, collection, images')
      .eq('is_active', true)

    if (error) throw error

    const productIds = (products || []).map(p => p.id)
    let skus = []
    if (productIds.length > 0) {
      const { data: skuRows, error: skuError } = await supabaseAdmin
        .from('product_skus')
        .select('id, product_id, sku_code, colour, width_mm, length_m, price_gbp, stock_qty, images')
        .in('product_id', productIds)
        .eq('is_active', true)
      if (skuError) throw skuError
      skus = skuRows || []
    }

    const skusByProduct = {}
    for (const sku of skus) {
      if (!skusByProduct[sku.product_id]) skusByProduct[sku.product_id] = []
      skusByProduct[sku.product_id].push(sku)
    }

    const itemsXml = (products || [])
      .flatMap(product => (skusByProduct[product.id] || []).map(sku => buildItemXml({ product, sku })))
      .filter(Boolean)
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(BRAND)} Product Feed</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>Google Shopping product feed for ${xmlEscape(BRAND)}</description>
${itemsXml}
  </channel>
</rss>
`

    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  } catch (err) {
    console.error('[google-feed]', err)
    // 出错也要返回结构合法的空 RSS，而不是一段 JSON 或者 HTML 错误页——
    // 后者会被 Google 的抓取器当成"完全无法解析"直接标记整个数据源失败。
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(BRAND)} Product Feed</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>Temporarily unavailable</description>
  </channel>
</rss>
`
    return new Response(fallback, {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  }
}
