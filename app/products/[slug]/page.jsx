import { createClient } from '@supabase/supabase-js'
import ProductClient from './ProductClient'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── 动态 Metadata ─────────────────────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const { slug } = await params
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
      images: image ? [{ url: image, width: 1200, height: 1200, alt: product.name }] : [],
      type: 'website',
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
  const { slug } = await params
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
