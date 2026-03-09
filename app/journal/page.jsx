export const metadata = {
  title: 'Journal — One Silk Ribbon',
  description: 'Stories, inspiration and guides from One Silk Ribbon.',
}

const posts = [
  {
    slug: 'how-to-tie-a-silk-ribbon-bow',
    date: 'March 2026',
    category: 'Guide',
    title: 'How to Tie a Silk Ribbon Bow',
    excerpt: 'The perfect bow is slower than it looks. We share our studio method — and the small adjustments that make all the difference.',
  },
  {
    slug: 'choosing-the-right-ribbon-width',
    date: 'February 2026',
    category: 'Guide',
    title: 'Choosing the Right Ribbon Width',
    excerpt: 'From 4mm to 38mm, every width has its ideal use. A practical guide to matching ribbon to occasion.',
  },
  {
    slug: 'the-story-behind-our-colours',
    date: 'January 2026',
    category: 'Behind the Scenes',
    title: 'The Story Behind Our Colours',
    excerpt: 'How we develop each colourway — from initial dye tests to the final name. Some colours take months to get right.',
  },
]

export default function Journal() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Journal</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)' }}>
            Stories &amp; Guides
          </h1>
        </div>

        {/* Post list */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 60px' }} className="journal-pad">
          {posts.map((post, i) => (
            <a key={post.slug} href={`/journal/${post.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 40px',
                padding: '40px 0', borderBottom: '1px solid var(--sand)',
                alignItems: 'start', gap: 40,
                transition: 'opacity .2s',
              }}
                className="post-row"
                onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <div>
                  <p style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>{post.category}</p>
                  <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.06em' }}>{post.date}</p>
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.2 }}>{post.title}</h2>
                  <p style={{ fontSize: 12, color: 'var(--taupe)', lineHeight: 1.9 }}>{post.excerpt}</p>
                </div>
                <div style={{ fontSize: 20, color: 'var(--warm)', paddingTop: 4 }}>→</div>
              </div>
            </a>
          ))}
        </div>

        {/* Coming soon note */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '60px 60px 100px' }} className="journal-pad">
          <p style={{ fontSize: 11, color: 'var(--warm)', letterSpacing: '.08em', fontStyle: 'italic' }}>
            More stories coming soon.
          </p>
        </div>

      </div>

      <style>{`
        @media(max-width: 768px) {
          .journal-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .post-row { grid-template-columns: 1fr !important; gap: 12px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </>
  )
}
