import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { permanentRedirect, notFound } from 'next/navigation'
import ProductClient from './ProductClient'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// generateMetadata 和页面组件是两次独立执行，用 React cache() 包一层——
// 同一次请求内两边都调用时，实际只会真正打一次数据库
const getProduct = cache(async (productSlug) => {
  const { data } = await supabaseServer.from('products').select('*').eq('slug', productSlug).single()
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
    : `Handcrafted 100% mulberry silk ribbon. Shop ${product.name} at One Silk Ribbon.`
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

  const { data: skus } = product
    ? await supabaseServer.from('product_skus').select('*').eq('product_id', product.id).order('price_gbp', { ascending: true })
    : { data: [] }

  // 同系列其他商品，给底部"More from this collection"用——只在真的有其他商品时才查/传，
  // 页面侧再判断一次是否为空来决定要不要渲染整个区块
  const { data: relatedRaw } = await supabaseServer
    .from('products')
    .select('id, name, slug, images')
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

  const jsonLd = product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description?.replace(/<[^>]+>/g, '') || '',
    image: Array.isArray(product.images) ? product.images : [],
    brand: { '@type': 'Brand', name: 'One Silk Ribbon' },
    sku: productSlug,
    url: `https://onesilkribbon.com/collections/${slug}/${productSlug}`,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'GBP',
      lowPrice: minPrice.toFixed(2),
      highPrice: maxPrice.toFixed(2),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: 'One Silk Ribbon' },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Collections', item: 'https://onesilkribbon.com/collections' },
        { '@type': 'ListItem', position: 2, name: product.collection?.replace(/-/g, ' ') || 'Products', item: `https://onesilkribbon.com/collections/${product.collection}` },
        { '@type': 'ListItem', position: 3, name: product.name, item: `https://onesilkribbon.com/collections/${slug}/${productSlug}` },
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
