import { cache } from 'react'
import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'

export const revalidate = 300

const SITE_ORIGIN = 'https://onesilkribbon.com'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// 站点默认分享图（相对路径，Next.js 会用 layout.jsx 里的 metadataBase 自动拼成绝对地址）
const DEFAULT_OG_IMAGE = '/og-image.jpg'

// generateMetadata 和页面组件共用同一条查询（也顺便让未发布的文章不会在 metadata 里提前泄露标题）
const getPost = cache(async (slug) => {
  const { data } = await supabaseServer
    .from('journal_posts').select('*').eq('slug', slug).eq('is_published', true).single()
  return data
})

export async function generateMetadata({ params }) {
  const { slug } = params
  const post = await getPost(slug)
  if (!post) return { title: 'Journal' }

  const image = post.cover_image || DEFAULT_OG_IMAGE

  return {
    // 根布局的 title.template 会自动拼上 "| One Silk Ribbon"，这里不用再带一遍
    title: post.title,
    description: post.excerpt || '',
    alternates: { canonical: `/journal/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt || '',
      url: `https://onesilkribbon.com/journal/${slug}`,
      siteName: 'One Silk Ribbon',
      locale: 'en_GB',
      type: 'article',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || '',
      images: [image],
    },
  }
}

export default async function JournalPost({ params }) {
  const { slug } = params
  const post = await getPost(slug)

  if (!post) notFound()

  const sections = Array.isArray(post.sections) ? post.sections : []

  // 文章页之前完全没有结构化数据（商品页有，这里一直漏着）。
  // BlogPosting 是 Google 识别"这是一篇文章"的依据，没有它就拿不到搜索结果里的
  // 日期、作者、缩略图这些富摘要，也更难被判定为有价值的内容页。
  const postUrl = `${SITE_ORIGIN}/journal/${slug}`
  const sectionImages = sections.filter(x => x.type === 'image' && x.url).map(x => x.url)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    // 正文里的配图也一并给出，Google 挑缩略图时有更多选择
    image: [post.cover_image, ...sectionImages].filter(Boolean),
    url: postUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    datePublished: post.published_at || undefined,
    // 没有改过就用发布时间，省得 Google 以为内容从未维护过
    dateModified: post.updated_at || post.published_at || undefined,
    articleSection: post.category || undefined,
    inLanguage: 'en-GB',
    author:    { '@type': 'Organization', name: 'One Silk Ribbon', url: SITE_ORIGIN },
    publisher: {
      '@type': 'Organization',
      name: 'One Silk Ribbon',
      url: SITE_ORIGIN,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/images/logo.png` },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Journal', item: `${SITE_ORIGIN}/journal` },
        { '@type': 'ListItem', position: 2, name: post.title, item: postUrl },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '72px 60px 56px', maxWidth: 1360, margin: '0 auto' }} className="post-header-pad">
          <Link href="/journal" style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            ← Journal
          </Link>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)' }}>{post.category}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--warm)', display: 'inline-block' }} />
            <span style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--taupe)' }}>{formatDate(post.published_at)}</span>
            {post.read_time && <>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--warm)', display: 'inline-block' }} />
              <span style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--taupe)' }}>{post.read_time}</span>
            </>}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 300, lineHeight: 1.1, color: 'var(--ink)', maxWidth: 700 }} className="post-h1">
            {post.title}
          </h1>
        </div>

        {/* Cover image */}
        {post.cover_image && (
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 60px' }} className="post-cover-pad">
            <div style={{ width: '100%', aspectRatio: '16/6', overflow: 'hidden', background: 'var(--sand)', marginTop: 48, position: 'relative' }}>
              <Image src={post.cover_image} alt={post.title} fill priority sizes="(max-width: 1360px) 100vw, 1360px" style={{ objectFit: 'cover' }} />
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '64px 60px 120px' }} className="post-pad">

          {/* Intro */}
          {post.intro && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', fontWeight: 300, lineHeight: 1.7, color: 'var(--taupe)', marginBottom: 56, paddingBottom: 48, borderBottom: '1px solid var(--sand)' }}>
              {post.intro}
            </p>
          )}

          {/* Sections */}
          {sections.map((s, i) => {
            const type = s.type || 'text'
            if (type === 'image') {
              if (!s.url) return null
              return (
                <figure key={i} style={{ margin: '0 0 48px', marginLeft: -60, marginRight: -60 }} className="post-figure">
                  <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: 'var(--sand)', position: 'relative' }}>
                    <Image src={s.url} alt={s.caption || post.title} fill loading="lazy" sizes="(max-width: 700px) 100vw, 700px" style={{ objectFit: 'cover' }} />
                  </div>
                  {s.caption && (
                    <figcaption style={{ fontSize: 11, letterSpacing: '.04em', color: 'var(--taupe)', textAlign: 'center', marginTop: 14, padding: '0 60px' }} className="post-figcaption">
                      {s.caption}
                    </figcaption>
                  )}
                </figure>
              )
            }
            return (
              <div key={i} style={{ marginBottom: 48 }}>
                {s.heading && (
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.3 }}>
                    {s.heading}
                  </h2>
                )}
                {s.body && <p style={{ fontSize: 16, fontWeight: 400, lineHeight: 2.2, color: 'var(--taupe)' }}>{s.body}</p>}
              </div>
            )
          })}

          {/* Closing */}
          {post.closing && (
            <div style={{ marginTop: 56, paddingTop: 48, borderTop: '1px solid var(--sand)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontStyle: 'italic', fontWeight: 300, lineHeight: 1.8, color: 'var(--ink)' }}>
                {post.closing}
              </p>
            </div>
          )}

          {/* Back link */}
          <div style={{ marginTop: 72 }}>
            <Link href="/journal" style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--taupe)', textDecoration: 'none', borderBottom: '1px solid var(--warm)', paddingBottom: 4 }} className="back-link">
              ← Back to Journal
            </Link>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .back-link:hover { color: var(--gold) !important; border-bottom-color: var(--gold) !important; }
        @media(max-width: 768px) {
          .post-header-pad { padding: 48px 24px 40px !important; }
          .post-cover-pad { padding: 0 24px !important; }
          .post-pad { padding: 48px 24px 80px !important; }
          .post-h1 { font-size: 32px !important; }
          .post-figure { margin-left: -24px !important; margin-right: -24px !important; }
          .post-figcaption { padding: 0 24px !important; }
        }
      ` }} />
    </>
  )
}
