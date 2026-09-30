import { supabaseAdmin } from '@osr/core/lib/supabase'

export default async function sitemap() {
  const baseUrl = 'https://onesilkribbon.com'

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/collections`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/shipping-returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/bespoke`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/care-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  // Product pages
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('slug, collection, updated_at')
    .eq('is_active', true)

  const productPages = (products || []).map(p => ({
    url: `${baseUrl}/collections/${p.collection}/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Collection pages —— 只收录真的有上架商品的系列。
  // 原来是硬编码 6 个系列全量提交，其中 patterned-ribbons 一个商品都没有（是故意留空的，
  // 等新品上架）。空系列页返回 200 但页面上什么都没有，Google 会判成"软 404"并计入
  // 未编入索引。改成按实际商品推导：系列一有商品就自动进 sitemap，清空了就自动退出，
  // 不需要回来改这个文件。
  const collectionsWithProducts = [...new Set((products || []).map(p => p.collection))].filter(Boolean)
  const collectionPages = collectionsWithProducts.map(slug => ({
    url: `${baseUrl}/collections/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Journal/blog pages — 字段是 is_published，不是 published（之前打错字段名，
  // 查询会报错、悄悄退化成空数组，导致 Journal 文章从未真正进过 sitemap）
  const { data: posts } = await supabaseAdmin
    .from('journal_posts')
    .select('slug, updated_at')
    .eq('is_published', true)

  const journalPages = (posts || []).map(p => ({
    url: `${baseUrl}/journal/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // /journal 列表页同理：一篇文章都没有的时候它只是一句 "No articles yet."，
  // 提交上去就是白送一个软 404。发了第一篇文章后会自动出现在这里。
  const journalIndex = journalPages.length > 0
    ? [{ url: `${baseUrl}/journal`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 }]
    : []

  return [...staticPages, ...journalIndex, ...collectionPages, ...productPages, ...journalPages]
}
