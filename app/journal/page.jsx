'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function JournalPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('journal_posts')
        .select('slug, title, category, excerpt, cover_image, read_time, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
      setPosts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }} className="journal-header-pad">
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Journal</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)' }} className="journal-h1">
            Stories &amp; Guides
          </h1>
        </div>

        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 60px' }} className="journal-pad">
          {loading ? (
            <p style={{ padding: '60px 0', color: 'var(--taupe)', fontSize: 13 }}>Loading…</p>
          ) : posts.length === 0 ? (
            <p style={{ padding: '60px 0', color: 'var(--taupe)', fontSize: 13 }}>No articles yet.</p>
          ) : posts.map((post) => (
            <Link key={post.slug} href={`/journal/${post.slug}`} className="post-row" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', padding: '40px 0', borderBottom: '1px solid var(--sand)', alignItems: 'start', gap: 40 }} className="post-row-inner">
                <div>
                  <p style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>{post.category}</p>
                  <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.06em' }}>{formatDate(post.published_at)}</p>
                  {post.read_time && <p style={{ fontSize: 10, color: 'var(--warm)', marginTop: 4 }}>{post.read_time}</p>}
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'start' }}>
                  {post.cover_image && (
                    <div style={{ width: 80, height: 80, flexShrink: 0, overflow: 'hidden', background: 'var(--sand)' }}>
                      <img src={post.cover_image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.2 }}>{post.title}</h2>
                    {post.excerpt && <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.9 }}>{post.excerpt}</p>}
                  </div>
                </div>
                <div style={{ fontSize: 20, color: 'var(--warm)', paddingTop: 4 }}>→</div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '60px 60px 100px' }} className="journal-pad">
          <Link href="/" style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--taupe)', textDecoration: 'none', borderBottom: '1px solid var(--warm)', paddingBottom: 4 }}>
            ← Back to Home
          </Link>
        </div>
      </div>

      <style>{`
        .post-row:hover h2 { color: var(--gold) !important; }
        @media(max-width: 768px) {
          .journal-header-pad { padding: 60px 24px 48px !important; }
          .journal-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .journal-h1 { font-size: 36px !important; }
          .post-row-inner { grid-template-columns: 1fr 24px !important; gap: 16px !important; }
          .post-row-inner > div:first-child { display: none; }
        }
      `}</style>
    </>
  )
}
