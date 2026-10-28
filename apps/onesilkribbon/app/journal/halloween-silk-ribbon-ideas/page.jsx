import HalloweenArticle from '@/components/journal/HalloweenArticle'
import { HALLOWEEN_ARTICLE as post } from '@/lib/journal-articles'
import { safeJsonLd } from '@/lib/safe-json-ld'

const origin = 'https://onesilkribbon.com'
const url = `${origin}/journal/${post.slug}`
const image = `${origin}${post.cover_image}`

export const metadata = {
  title: post.title,
  description: post.excerpt,
  alternates: { canonical: `/journal/${post.slug}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: post.title,
    description: post.excerpt,
    url,
    siteName: 'One Silk Ribbon',
    type: 'article',
    locale: 'en_GB',
    publishedTime: post.published_at,
    modifiedTime: post.updated_at,
    images: [{ url: image, width: 1200, height: 900, alt: 'Gold silk pumpkin brooch with ribbon embroidery' }],
  },
  twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt, images: [image] },
}

export default function HalloweenJournalPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        headline: post.title,
        description: post.excerpt,
        image: [image],
        datePublished: post.published_at,
        dateModified: post.updated_at,
        articleSection: post.category,
        inLanguage: 'en-GB',
        author: { '@type': 'Organization', name: 'One Silk Ribbon', url: origin },
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Journal', item: `${origin}/journal` },
          { '@type': 'ListItem', position: 2, name: post.title, item: url },
        ],
      },
    ],
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} />
    <HalloweenArticle />
  </>
}
