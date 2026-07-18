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
  const { slug } = await params
  const meta = COLLECTION_META[slug]
  if (!meta) return { title: 'Collection | One Silk Ribbon' }

  return {
    title: `${meta.name} | One Silk Ribbon`,
    description: meta.desc,
    openGraph: {
      title: `${meta.name} | One Silk Ribbon`,
      description: meta.desc,
      url: `https://onesilkribbon.com/collections/${slug}`,
      type: 'website',
    },
  }
}

export default async function CollectionPage({ params }) {
  const { slug } = await params
  const meta = COLLECTION_META[slug]

  const { data: products } = await supabaseServer
    .from('products')
    .select('id, name, slug, images, collection, description')
    .eq('collection', slug)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

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
      <CollectionClient initialProducts={products || []} slug={slug} />
    </>
  )
}
