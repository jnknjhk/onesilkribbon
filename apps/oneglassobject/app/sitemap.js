import { supabaseAdmin } from '@osr/core/lib/supabase'
import { site, COLLECTION_SLUGS } from '@/config/site'

export default async function sitemap() {
  const baseUrl = site.url

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

  // Collection pages
  const collections = COLLECTION_SLUGS
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

  return [...staticPages, ...collectionPages, ...productPages]
}
