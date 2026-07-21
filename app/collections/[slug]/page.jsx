import { createClient } from '@supabase/supabase-js'
import CollectionClient from './CollectionClient'

const COLLECTION_META = {
  'fine-silk-ribbons':        { name: 'Fine Silk Ribbons',        desc: 'Our signature ultra-fine 100% mulberry silk ribbons, in widths from 2mm to 10mm and 30 hand-selected colourways.' },
  'hand-frayed-silk-ribbons': { name: 'Hand-Frayed Silk Ribbons', desc: 'Each edge carefully frayed by hand for an ethereal, organic finish. Perfect for bouquets, invitations and fine craft.' },
  'handcrafted-adornments':   { name: 'Handcrafted Adornments',   desc: 'Silk scrunchies, bows and decorative pieces — each made by hand from pure mulberry silk.' },
  'patterned-ribbons':        { name: 'Patterned Ribbons',        desc: 'Botanical, geometric and heritage-inspired patterns printed on pure silk.' },
  'studio-tools':             { name: 'Studio Tools',             desc: 'Everything you need for a well-appointed ribbon and craft studio.' },
  'vintage-inspired-ribbons': { name: 'Vintage-Inspired Ribbons', desc: 'Heritage tones and antique-inspired textures, evoking the romance of a bygone era.' },
}

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function generateMetadata({ params }) {
  const { slug } = params
  const meta = COLLECTION_META[slug]
  if (!meta) return { title: 'Collection | One Silk Ribbon' }

  // generateMetadata 和页面组件是两次独立执行，拿不到组件里查好的 heroImage，这里单独查一次
  const { data: heroImageData } = await supabaseServer
    .from('site_images')
    .select('url')
    .eq('key', `hero_${slug}`)
    .single()
  const heroImage = heroImageData?.url || null

  const title = `${meta.name} | One Silk Ribbon`

  return {
    title,
    description: meta.desc,
    openGraph: {
      title,
      description: meta.desc,
      url: `https://onesilkribbon.com/collections/${slug}`,
      siteName: 'One Silk Ribbon',
      locale: 'en_GB',
      type: 'website',
      images: heroImage ? [{ url: heroImage, width: 1200, height: 630, alt: meta.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: meta.desc,
      images: heroImage ? [heroImage] : [],
    },
  }
}

export default async function CollectionPage({ params }) {
  const { slug } = params
  const meta = COLLECTION_META[slug]

  // Fetch hero image server-side (avoid admin API call from client)
  const { data: heroImageData } = await supabaseServer
    .from('site_images')
    .select('url')
    .eq('key', `hero_${slug}`)
    .single()
  const heroImage = heroImageData?.url || null

  const { data: rawProducts } = await supabaseServer
    .from('products')
    .select('id, name, slug, images, collection, description')
    .eq('collection', slug)
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  // Fetch SKU prices server-side to avoid N+1 on client
  let products = rawProducts || []
  if (products.length > 0) {
    const productIds = products.map(p => p.id)
    const { data: allSkus } = await supabaseServer
      .from('product_skus')
      .select('product_id, price_gbp, colour_hex, id, stock_qty')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('price_gbp', { ascending: true })

    const skuMap = {}
    if (allSkus) {
      allSkus.forEach(s => {
        if (!skuMap[s.product_id]) skuMap[s.product_id] = s
      })
    }

    products = products.map(p => ({
      ...p,
      lowestPrice: parseFloat(skuMap[p.id]?.price_gbp || 0),
      firstSku: skuMap[p.id] || null,
    }))
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: meta?.name || slug,
    description: meta?.desc || '',
    url: `https://onesilkribbon.com/collections/${slug}`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Collections', item: 'https://onesilkribbon.com/collections' },
        { '@type': 'ListItem', position: 2, name: meta?.name || slug, item: `https://onesilkribbon.com/collections/${slug}` },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CollectionClient initialProducts={products || []} slug={slug} initialHeroImage={heroImage} />
    </>
  )
}
