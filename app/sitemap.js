import { supabaseAdmin } from '@/lib/supabase'

export default async function sitemap() {
  const baseUrl = 'https://onesilkribbon.com'

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/collections`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/journal`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/shipping-returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/bespoke`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/care-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  // Collection pages
  const collections = [
    'fine-silk-ribbons', 'hand-frayed-silk-ribbons', 'handcrafted-adornments',
    'patterned-ribbons', 'studio-tools', 'vintage-inspired-ribbons',
  ]
  const collectionPages = collections.map(slug => ({
    url: `${baseUrl}/collections/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

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

  return [...staticPages, ...collectionPages, ...productPages, ...journalPages]
}
