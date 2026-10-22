import { cache } from 'react'
import { safeJsonLd } from '@/lib/safe-json-ld'
import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import { notFound } from 'next/navigation'
import CollectionClient from './CollectionClient'

export const revalidate = 60

// seoTitle 只用于 <title>，name 继续给 H1、面包屑、结构化数据用。
// 原来集合页 <title> 直接取 name，拼上品牌模板也只有 36 个字符——
// "Fine Silk Ribbons | One Silk Ribbon"，把 60 字符的标题位浪费了将近一半，
// 而 "2mm silk ribbon"、"hand frayed silk ribbon" 这类规格词恰恰是
// 大词抢不过、又确实有人搜的长尾。这里只做加法：保留原名，补规格和品类。
const COLLECTION_META = {
  'fine-silk-ribbons':        { name: 'Fine Silk Ribbons',        seoTitle: 'Fine Silk Ribbons, 2mm–10mm Mulberry Silk', desc: 'Our signature ultra-fine 100% mulberry silk ribbons for UK weddings and invitations, in widths from 2mm to 10mm and 30 hand-dyed colourways.' },
  'hand-frayed-silk-ribbons': { name: 'Hand-Frayed Silk Ribbons', seoTitle: 'Hand-Frayed Mulberry Silk Ribbons', desc: 'Each edge carefully hand-frayed for an ethereal, organic finish. Perfect for UK wedding bouquets, invitations and fine floristry.' },
  'handcrafted-adornments':   { name: 'Handcrafted Adornments',   seoTitle: 'Handcrafted Silk Bows & Scrunchies', desc: 'Handmade silk scrunchies, bows and decorative pieces — perfect wedding favours and gifts, made from pure mulberry silk in the UK.' },
  'patterned-ribbons':        { name: 'Patterned Ribbons',        seoTitle: 'Patterned Mulberry Silk Ribbons', desc: 'Botanical, geometric and heritage-inspired patterns hand-printed on pure silk — ideal for bouquets and gift wrapping.' },
  'studio-tools':             { name: 'Studio Tools',             seoTitle: 'Studio Tools for Ribbon Makers & Florists', desc: 'Everything you need for a well-appointed ribbon, floristry and craft studio.' },
  'vintage-inspired-ribbons': { name: 'Vintage-Inspired Ribbons', seoTitle: 'Vintage-Inspired Mulberry Silk Ribbons', desc: 'Heritage tones and antique-inspired textures for romantic UK weddings, evoking the beauty of a bygone era.' },
}

// generateMetadata 和页面组件都要用同一张 hero 图，用 cache() 包一层避免同一次请求打两次库
const getHeroImage = cache(async (slug) => {
  const { data } = await supabaseServer.from('site_images').select('url').eq('key', `hero_${slug}`).single()
  return data?.url || null
})

// 这个系列现在有几个上架商品。用来决定要不要让搜索引擎收录——
// 空系列页返回 200 但页面上没有任何商品，Google 会判成"软 404"。
const getActiveProductCount = cache(async (slug) => {
  const { count } = await supabaseServer
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('collection', slug)
    .eq('is_active', true)
  return count || 0
})

export async function generateMetadata({ params }) {
  const { slug } = params
  const meta = COLLECTION_META[slug]
  if (!meta) return { title: 'Collection' }

  const heroImage = await getHeroImage(slug)
  // 系列还没上架商品时先别让它进索引（比如 patterned-ribbons 是特意留空等新品的）。
  // follow 保持开启，页面上的导航链接权重照常传递；上架第一个商品后会自动恢复收录，
  // 不需要回来改代码。
  const productCount = await getActiveProductCount(slug)
  // 根布局的 title.template 会自动拼上 "| One Silk Ribbon"，<title> 用短标题；
  // openGraph/twitter 不走 template，单独给带完整品牌的版本
  const title = meta.seoTitle || meta.name
  const socialTitle = `${meta.name} | One Silk Ribbon`

  return {
    title,
    description: meta.desc,
    alternates: { canonical: `/collections/${slug}` },
    ...(productCount === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: socialTitle,
      description: meta.desc,
      url: `https://onesilkribbon.com/collections/${slug}`,
      siteName: 'One Silk Ribbon',
      locale: 'en_GB',
      type: 'website',
      images: heroImage ? [{ url: heroImage, width: 1200, height: 630, alt: meta.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: meta.desc,
      images: heroImage ? [heroImage] : [],
    },
  }
}

export default async function CollectionPage({ params }) {
  const { slug } = params
  const meta = COLLECTION_META[slug]
  // 系列 slug 不在这 6 个已知系列里——之前这里不管 meta 存不存在都照样往下渲染，
  // 只是显示成一个空的、用 slug 当标题的页面，HTTP 状态码还是 200，不是真的 404
  if (!meta) notFound()

  const heroImage = await getHeroImage(slug)

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
    // 列出这个系列里实际有哪些商品。少了它，Google 只知道"这是一个系列页"，
    // 不知道页面上陈列着什么，也就无从把系列页和具体商品关联起来。
    ...(products.length > 0 ? {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://onesilkribbon.com/collections/${slug}/${p.slug}`,
          name: p.name,
        })),
      },
    } : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <CollectionClient initialProducts={products || []} slug={slug} initialHeroImage={heroImage} />
    </>
  )
}
