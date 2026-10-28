// Designed editorial articles live in source control; CMS articles stay in Supabase.
// Use the same published catalogue for the Journal index and the sitemap.
export const HALLOWEEN_ARTICLE = {
  slug: 'halloween-silk-ribbon-ideas',
  title: 'Halloween Ribbon Ideas: Bows, Pumpkins and Autumn Colours',
  category: 'Seasonal Styling',
  excerpt: 'Style Halloween with silk ribbon bows, pumpkin decorations and thoughtful gift wrapping in burgundy, espresso brown and champagne gold.',
  cover_image: '/images/journal/halloween/pumpkin-brooch.jpg',
  read_time: '4 min read',
  published_at: '2026-10-28T04:05:00.000Z',
  updated_at: '2026-10-28T04:05:00.000Z',
  is_published: true,
}

export function mergePublishedJournalPosts(databasePosts = []) {
  const bySlug = new Map(databasePosts.map(post => [post.slug, post]))
  // The dedicated source route owns this slug if a CMS entry also exists.
  bySlug.set(HALLOWEEN_ARTICLE.slug, HALLOWEEN_ARTICLE)
  return [...bySlug.values()].sort((a, b) =>
    (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0))
}
