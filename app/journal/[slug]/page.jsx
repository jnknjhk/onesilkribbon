import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// 站点默认分享图（相对路径，Next.js 会用 layout.jsx 里的 metadataBase 自动拼成绝对地址）
const DEFAULT_OG_IMAGE = '/og-image.jpg'

export async function generateMetadata({ params }) {
  const { slug } = params
  const { data: post } = await supabaseServer
    .from('journal_posts').select('title, excerpt, cover_image').eq('slug', slug).single()
  if (!post) return { title: 'Journal — One Silk Ribbon' }

  const image = post.cover_image || DEFAULT_OG_IMAGE

  return {
    title: `${post.title} — One Silk Ribbon`,
    description: post.excerpt || '',
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
  const { data: post } = await supabaseServer
    .from('journal_posts').select('*').eq('slug', slug).eq('is_published', true).single()

  if (!post) notFound()

  const sections = Array.isArray(post.sections) ? post.sections : []

  return (
    <>
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
            <div style={{ width: '100%', aspectRatio: '16/6', overflow: 'hidden', background: 'var(--sand)', marginTop: 48 }}>
              <img src={post.cover_image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 48 }}>
              {s.heading && (
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.3 }}>
                  {s.heading}
                </h2>
              )}
              {s.body && <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)' }}>{s.body}</p>}
            </div>
          ))}

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

      <style>{`
        .back-link:hover { color: var(--gold) !important; border-bottom-color: var(--gold) !important; }
        @media(max-width: 768px) {
          .post-header-pad { padding: 48px 24px 40px !important; }
          .post-cover-pad { padding: 0 24px !important; }
          .post-pad { padding: 48px 24px 80px !important; }
          .post-h1 { font-size: 32px !important; }
        }
      `}</style>
    </>
  )
}
