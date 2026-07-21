import { createClient } from '@supabase/supabase-js'
import ProductClient from './ProductClient'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── 动态 Metadata ─────────────────────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const { slug } = params
  const { data: product } = await supabaseServer
    .from('products').select('name, description, images, collection').eq('slug', slug).single()

  if (!product) return { title: 'Product Not Found' }

  const title = `${product.name} — One Silk Ribbon`
  const description = product.description
    ? product.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Handcrafted 100% mulberry silk ribbon. Shop ${product.name} at One Silk Ribbon.`
  const image = Array.isArray(product.images) ? product.images[0] : null

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://onesilkribbon.com/products/${slug}`,
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
      title,
      description,
      images: image ? [image] : [],
    },
  }
}

// ── 服务端渲染：预取产品数据 ───────────────────────────────────────────────────
export default async function ProductPage({ params }) {
  const { slug } = params
  const { data: product } = await supabaseServer
    .from('products').select('*').eq('slug', slug).single()

  const { data: skus } = product
    ? await supabaseServer.from('product_skus').select('*').eq('product_id', product.id).order('price_gbp', { ascending: true })
    : { data: [] }

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
    sku: slug,
    url: `https://onesilkribbon.com/products/${slug}`,
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
        { '@type': 'ListItem', position: 3, name: product.name, item: `https://onesilkribbon.com/products/${slug}` },
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
      <ProductClient initialProduct={product} initialSkus={skus || []} slug={slug} />
    </>
  )
}
