import Link from 'next/link'
import { notFound } from 'next/navigation'

const posts = {
  'how-to-tie-a-silk-ribbon-bow': {
    title: 'How to Tie a Silk Ribbon Bow',
    date: 'March 2026',
    category: 'Guide',
    readTime: '4 min read',
    intro: 'The perfect bow is slower than it looks. Here is our studio method — and the small adjustments that make all the difference.',
    sections: [
      {
        heading: 'Start with the right length',
        body: 'For a generous, full bow, cut at least 80cm of ribbon. For a smaller finishing bow on a gift tag, 40–50cm is sufficient. The most common mistake is working with too little ribbon and rushing the loops.',
      },
      {
        heading: 'Hold the centre, not the ends',
        body: 'Pinch the ribbon firmly at its centre point between your thumb and forefinger. This is your anchor. Everything else moves around this fixed point — if the centre shifts, the bow will twist.',
      },
      {
        heading: 'Make the first loop deliberately',
        body: 'Bring one end up and over to form a loop, holding it against the centre. Do not pull tight yet. The loop should be about 4–5cm across — larger than you think you need, as silk has a natural tendency to relax.',
      },
      {
        heading: 'Wrap and pull through',
        body: 'Take the other end, wrap it once around the centre, and push a small loop through from behind — exactly as you would tie a shoelace. Pull gently and evenly on both loops simultaneously. Silk responds to patience: a slow, even pull produces a far neater result than a quick tug.',
      },
      {
        heading: 'Adjust while it is still loose',
        body: 'Before tightening fully, adjust the two loops so they are roughly equal in size. Ease them out from the centre rather than pulling on the tails. Once you are happy with the shape, pull the centre knot snug.',
      },
      {
        heading: 'Trim the tails',
        body: 'Cut the tails at an angle or in a shallow V for a clean finish. For hand-frayed ribbons, the tails can be left long and slightly pulled to encourage the natural fraying further.',
      },
    ],
    closing: 'The hallmark of a silk bow is its looseness — it should look effortless rather than engineered. If it takes you three attempts, that is normal. The fourth will feel instinctive.',
  },

  'choosing-the-right-ribbon-width': {
    title: 'Choosing the Right Ribbon Width',
    date: 'February 2026',
    category: 'Guide',
    readTime: '3 min read',
    intro: 'From 4mm to 38mm, every width has its ideal use. A practical guide to matching ribbon to occasion.',
    sections: [
      {
        heading: '4mm — the finest line',
        body: 'At 4mm, the ribbon functions almost as a thread. It is best used for tying small posies, wrapping delicate jewellery boxes, or weaving through boutonnieres. At this width, the silk\'s sheen is the entire statement — keep everything else minimal.',
      },
      {
        heading: '7mm — the everyday elegance',
        body: 'Our most versatile width. Fine enough to feel considered, substantial enough to tie a proper bow. Works beautifully on mid-sized gifts, around candles, and for hair ribbons. If you are buying one width to start, this is it.',
      },
      {
        heading: '10mm — the gift ribbon standard',
        body: 'The width most people picture when they think of a silk ribbon. Generous enough for a full bow, narrow enough to look refined. Ideal for wrapping boxes, tying around tissue, and finishing hampers.',
      },
      {
        heading: '15mm — for floristry and gatherings',
        body: 'At 15mm, the ribbon begins to drape rather than just tie. This width is particularly good for bridal bouquets, where a trailing end adds movement, and for napkin rings, where you want visible presence without overwhelming the table.',
      },
      {
        heading: '25mm — the statement width',
        body: 'Wide enough to be seen across a room. At 25mm, a single loop of silk makes an impact. Use it on larger gift boxes, around vases, as a sash on a wedding dress, or as a headband. The hand-frayed version at this width is particularly striking.',
      },
      {
        heading: '38mm — for interiors and large-scale work',
        body: 'Our widest ribbon is used most often in interior styling — tied around chair backs at events, draped over curtain rails, or used as a luxurious bow on oversized packages. At this width, the crepe satin texture and natural dye variation become fully visible.',
      },
    ],
    closing: 'When in doubt, go wider. A larger bow can always be adjusted; a ribbon that is too narrow tends to look accidental rather than considered.',
  },

  'the-story-behind-our-colours': {
    title: 'The Story Behind Our Colours',
    date: 'January 2026',
    category: 'Behind the Scenes',
    readTime: '5 min read',
    intro: 'How we develop each colourway — from initial dye tests to the final name. Some colours take months to get right.',
    sections: [
      {
        heading: 'It starts with an observation',
        body: 'Most of our colours begin not in a lab but in the world. Espresso came from the ring left by a coffee cup on a linen cloth. Aqua Mist came from the particular grey-green of the Thames on an overcast morning. We keep a running list of colours we want to recreate — things seen, not invented.',
      },
      {
        heading: 'The first dye test',
        body: 'Natural dyes on silk are deeply unpredictable. The same dye bath can produce markedly different results depending on the mordant used, the water temperature, the pH, and even the mineral content of the water that day. Our first test for any new colour is always exploratory — we are looking for the direction, not the destination.',
      },
      {
        heading: 'Why it takes so long',
        body: 'Champagne Gold took four months. The difficulty was not achieving a gold tone — that is relatively straightforward with iron mordants — but achieving a gold that photographed honestly. Many natural golds look warm and luminous in person but appear flat or yellow on screen. We ran seventeen dye baths before we found the balance.',
      },
      {
        heading: 'Naming the colour',
        body: 'The name comes last, and it is always the hardest part. We are trying to give someone who has never seen the ribbon a sense of what they will receive — not just the hue, but its character. Cinnamon Rose is warmer and dustier than a standard rose. Lotus Pink is softer and more muted than the name might suggest. The name is a shorthand for a feeling, not a specification.',
      },
      {
        heading: 'Variation between batches',
        body: 'Because we dye naturally, no two batches are identical. The variation is typically subtle — a slightly deeper tone, a marginally cooler undertone — but it is there. We consider this part of the ribbon\'s character rather than a flaw. A ribbon that has been made, rather than manufactured, carries the evidence of its making.',
      },
    ],
    closing: 'We currently have 14 colourways in production. There are another 8 in development — some of which have been "almost right" for over a year. We will release them when they are ready.',
  },
}

export async function generateStaticParams() {
  return Object.keys(posts).map(slug => ({ slug }))
}

export async function generateMetadata({ params }) {
  const post = posts[params.slug]
  if (!post) return {}
  return {
    title: `${post.title} — One Silk Ribbon Journal`,
    description: post.intro,
  }
}

export default function JournalPost({ params }) {
  const post = posts[params.slug]
  if (!post) notFound()

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '72px 60px 56px', maxWidth: 1360, margin: '0 auto' }}>
          <Link href="/journal" style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            ← Journal
          </Link>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)' }}>{post.category}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--warm)', display: 'inline-block' }} />
            <span style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--taupe)' }}>{post.date}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--warm)', display: 'inline-block' }} />
            <span style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--taupe)' }}>{post.readTime}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 300, lineHeight: 1.1, color: 'var(--ink)', maxWidth: 700 }}>
            {post.title}
          </h1>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '64px 60px 120px' }} className="post-pad">

          {/* Intro */}
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', fontWeight: 300, lineHeight: 1.7, color: 'var(--taupe)', marginBottom: 56, paddingBottom: 48, borderBottom: '1px solid var(--sand)' }}>
            {post.intro}
          </p>

          {/* Sections */}
          {post.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 48 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.3 }}>
                {s.heading}
              </h2>
              <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)' }}>{s.body}</p>
            </div>
          ))}

          {/* Closing */}
          <div style={{ marginTop: 56, paddingTop: 48, borderTop: '1px solid var(--sand)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontStyle: 'italic', fontWeight: 300, lineHeight: 1.8, color: 'var(--ink)' }}>
              {post.closing}
            </p>
          </div>

          {/* Back link */}
          <div style={{ marginTop: 72 }}>
            <Link href="/journal" style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--taupe)', textDecoration: 'none', borderBottom: '1px solid var(--warm)', paddingBottom: 4, transition: 'color .2s' }} className="back-link">
              ← Back to Journal
            </Link>
          </div>

        </div>
      </div>

      <style>{`
        .back-link:hover { color: var(--gold) !important; border-bottom-color: var(--gold) !important; }
        @media(max-width: 768px) {
          .post-pad { padding: 48px 24px 80px !important; }
          h1 { font-size: 32px !important; }
        }
      `}</style>
    </>
  )
}
