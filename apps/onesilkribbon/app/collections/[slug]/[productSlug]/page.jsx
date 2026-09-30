import { cache } from 'react'
import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import { permanentRedirect, notFound } from 'next/navigation'
import ProductClient from './ProductClient'

export const revalidate = 60

const SITE_ORIGIN = 'https://onesilkribbon.com'

// 运费设置和结账时用的是同一份数据（settings 表），这样结构化数据里申报的运费
// 永远跟实际收的一致——搜索结果写免邮、结账却要付钱是最糟的情况。
// cache() 让 generateMetadata 和页面组件共用同一次查询。
const getSettings = cache(async () => {
  const { data } = await supabaseServer.from('settings').select('key, value')
  return Object.fromEntries((data || []).map(r => [r.key, r.value]))
})

// generateMetadata 和页面组件是两次独立执行，用 React cache() 包一层——
// 同一次请求内两边都调用时，实际只会真正打一次数据库
// 必须过滤 is_active：少了这个条件，后台下架的商品只要还知道链接就照样能打开，
// 还会带着完整的价格和结构化数据给搜索引擎收录。结账时服务端会拦住不让真的买到，
// 但客户已经点进来选好规格了才被拒，体验很差。
const getProduct = cache(async (productSlug) => {
  const { data } = await supabaseServer
    .from('products').select('*')
    .eq('slug', productSlug)
    .eq('is_active', true)
    .maybeSingle()
  return data
})

// ── 动态 Metadata ─────────────────────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const { slug, productSlug } = params
  const product = await getProduct(productSlug)

  if (!product) return { title: 'Product Not Found' }

  const canonicalPath = `/collections/${product.collection}/${productSlug}`

  // 根布局的 title.template 会自动在 <title> 后面拼上 "| One Silk Ribbon"，
  // 这里给 <title> 用的是不带品牌后缀的短标题；openGraph/twitter 不走 template，
  // 单独给一个带完整品牌的版本，社交平台分享卡片上才不会显得没头没尾。
  const title = product.name
  const socialTitle = `${product.name} — One Silk Ribbon`
  const description = product.description
    ? product.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Handmade 100% mulberry silk ribbon, hand-dyed in the UK. Perfect for weddings and bouquets. Shop ${product.name} at One Silk Ribbon.`
  const image = Array.isArray(product.images) ? product.images[0] : null

  return {
    title,
    description,
    // URL 里的系列 slug 和商品实际所属系列不一致时（比如后台改了商品的系列），
    // canonical 始终指向按商品真实 collection 算出来的那条 URL，
    // 而不是当前请求里可能过时的 slug 参数——避免同一个商品在两条 URL 下被重复收录。
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: socialTitle,
      description,
      url: `https://onesilkribbon.com${canonicalPath}`,
      siteName: 'One Silk Ribbon',
      locale: 'en_GB',
      images: image ? [{ url: image, width: 1200, height: 1200, alt: product.name }] : [],
      // 注意：Next.js 的 openGraph.type 只接受一个固定枚举（website/article/book/profile/...），
      // 'product' 不在其中，写进这里会在请求时直接抛异常（Invalid OpenGraph type）。
      // og:type=product 和 product:price:* 这几个标签改在下面页面组件里用 <meta property=.../> 手写，
      // 因为 Metadata API 的 other 字段只会渲染成 <meta name=...>，Facebook 官方爬虫按 og 规范只认 property。
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: image ? [image] : [],
    },
  }
}

// ── 服务端渲染：预取产品数据 ───────────────────────────────────────────────────
export default async function ProductPage({ params }) {
  const { slug, productSlug } = params
  const product = await getProduct(productSlug)

  // 商品不存在——之前这里不管 product 是不是 null 都照样往下渲染，只是 ProductClient
  // 里显示一个"Product not found"的样子，HTTP 状态码还是 200，不是真的 404
  if (!product) notFound()

  // URL 里的系列 slug 和商品实际所属系列对不上（后台改了商品分类、或者有人手改了 URL），
  // 301 到按商品真实 collection 算出来的正确 URL，而不是直接 404 或者忍受重复内容
  if (product.collection !== slug) {
    permanentRedirect(`/collections/${product.collection}/${productSlug}`)
  }

  // 同样要过滤 is_active，否则已停用的规格会出现在规格选择器和页面的结构化数据里，
  // 客户能选中、能加进购物车，一路到结账才被服务端拒绝
  const { data: skus } = product
    ? await supabaseServer.from('product_skus').select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('price_gbp', { ascending: true })
    : { data: [] }

  // 同系列其他商品，给底部"More from this collection"用——只在真的有其他商品时才查/传，
  // 页面侧再判断一次是否为空来决定要不要渲染整个区块
  const { data: relatedRaw } = await supabaseServer
    .from('products')
    .select('id, name, slug, images, collection')
    .eq('collection', product.collection)
    .eq('is_active', true)
    .neq('id', product.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .limit(4)

  let related = []
  if (relatedRaw && relatedRaw.length > 0) {
    const relatedIds = relatedRaw.map(p => p.id)
    const { data: relatedSkus } = await supabaseServer
      .from('product_skus')
      .select('product_id, price_gbp')
      .in('product_id', relatedIds)
      .eq('is_active', true)
      .order('price_gbp', { ascending: true })

    const priceMap = {}
    for (const s of (relatedSkus || [])) {
      if (!(s.product_id in priceMap)) priceMap[s.product_id] = s.price_gbp
    }
    related = relatedRaw.map(p => ({ ...p, price: priceMap[p.id] || 0 }))
  }

  // Product Structured Data (JSON-LD)
  const minPrice = skus && skus.length > 0
    ? Math.min(...skus.map(s => parseFloat(s.price_gbp) || 0))
    : 0
  const maxPrice = skus && skus.length > 0
    ? Math.max(...skus.map(s => parseFloat(s.price_gbp) || 0))
    : 0
  const inStock = skus && skus.some(s => (s.stock_qty || 0) > 0)
  const image = product && Array.isArray(product.images) ? product.images[0] : null
  const hasPrice = skus && skus.length > 0

  const productUrl = `https://onesilkribbon.com/collections/${slug}/${productSlug}`

  // Google Shopping/Merchant Center 要求商品必须带至少一个标识符（gtin/mpn/isbn 三选一）。
  // 手工小批量产品没有真正的条码，用内部 slug 顶 mpn（制造商料号）——总比完全不填、
  // 被 Google 判定"缺商品标识符"要好；等以后如果有真的 UPC/EAN 条码，直接把这行换成 gtin 即可。
  const settings = await getSettings()

  const hasValidOffer = hasPrice && minPrice > 0

  // ── 配送与退货的结构化数据 ────────────────────────────────────────────────
  // 运费取后台 settings 的真实值（和结账时算的是同一份数据），不是写死的。
  const freeShippingEnabled = settings.free_shipping_enabled === 'true'
  const freeThreshold = parseFloat(settings.free_shipping_threshold || '0') || 0
  const shippingRate = parseFloat(settings.shipping_rate || '0') || 0
  // 满额免邮时，一件商品是否免邮取决于整车金额，单品页面无法确定，
  // 所以这里申报的是「不满额时的标准运费」——宁可报高不报低，免得客户看到
  // 搜索结果写免邮、到结账却要付钱。
  const shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: shippingRate.toFixed(2),
      currency: 'GBP',
    },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'GB' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      // /shipping-returns：付款后 2 个工作日内发出
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
      // /shipping-returns：空运，发出后通常 5–14 天送达
      transitTime: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 14, unitCode: 'DAY' },
    },
    ...(freeShippingEnabled && freeThreshold > 0 ? {
      // 满 £49 免邮，写成"订单满额免运费"这条单独的规则
      shippingSettingsLink: `${SITE_ORIGIN}/shipping-returns`,
    } : {}),
  }

  // 退货：/shipping-returns 写明接受退货、需先联系、退货运费由客户承担，
  // 但没有写明"几天内可退"。这里填 14 天——英国远程销售法定的最低冷静期，
  // 取法定下限是最保守、也一定站得住的口径。若你实际给的期限更长，
  // 请同时改这里和 /shipping-returns 页面，两处必须一致。
  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'GB',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnShippingFees',
    merchantReturnLink: `${SITE_ORIGIN}/shipping-returns`,
  }

  // 价格有效期给一年后；页面重新生成时会跟着往后滚，不会过期
  const priceValidUntil = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

  const jsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description?.replace(/<[^>]+>/g, '') || '',
    image: Array.isArray(product.images) ? product.images : [],
    brand: { '@type': 'Brand', name: 'One Silk Ribbon' },
    material: 'Mulberry Silk',
    sku: productSlug,
    mpn: productSlug,
    url: productUrl,
    // 没有任何在售 SKU（比如全部下架/缺库存价格）时，宁可不输出 offers，
    // 也不要给 Google 一个 £0.00 的假报价——那会被 Merchant Center 当异常商品打回
    ...(hasValidOffer ? {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'GBP',
        lowPrice: minPrice.toFixed(2),
        highPrice: maxPrice.toFixed(2),
        offerCount: skus.length,
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: productUrl,
        seller: { '@type': 'Organization', name: 'One Silk Ribbon', url: 'https://onesilkribbon.com' },
        // 价格有效期。Google 对没有 priceValidUntil 的报价会逐渐降低信任，
        // 给一年后的日期即可——价格改了页面重新生成，这个日期也会跟着往后滚。
        priceValidUntil: priceValidUntil,
        // 配送和退货：Google 现在会把"免运费""X天退货"直接做成搜索结果里的标签，
        // 有这两段的商品在结果里明显更醒目。数值全部取自后台 settings 和
        // /shipping-returns 页面的真实政策，不能凭空写——这是对消费者的承诺。
        shippingDetails: shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      },
    } : {}),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Collections', item: 'https://onesilkribbon.com/collections' },
        { '@type': 'ListItem', position: 2, name: product.collection?.replace(/-/g, ' ') || 'Products', item: `https://onesilkribbon.com/collections/${product.collection}` },
        { '@type': 'ListItem', position: 3, name: product.name, item: productUrl },
      ],
    },
  } : null

  return (
    <>
      {product && (
        <>
          {/* generateMetadata 里的 openGraph.type 不能设成 'product'（Next.js 会校验报错），
              这几个标签只能在这里手写 property=，Facebook/Pinterest 的商品富预览靠它们触发 */}
          <meta property="og:type" content="product" />
          {hasPrice && <>
            <meta property="product:price:amount" content={minPrice.toFixed(2)} />
            <meta property="product:price:currency" content="GBP" />
            <meta property="og:price:amount" content={minPrice.toFixed(2)} />
            <meta property="og:price:currency" content="GBP" />
          </>}
        </>
      )}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductClient initialProduct={product} initialSkus={skus || []} slug={productSlug} related={related} />
    </>
  )
}
