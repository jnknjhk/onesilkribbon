export const metadata = {
  title: 'Our Story — One Silk Ribbon',
  description: 'The story behind One Silk Ribbon — handcrafted mulberry silk ribbons made with care.',
}

export default function About() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Hero */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Our Story</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)', maxWidth: 640 }}>
            Made by hand.<br /><em>Made with intention.</em>
          </h1>
        </div>

        {/* Section 1 — text + image */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: 1360, margin: '0 auto', padding: '0 60px' }} className="about-grid">
          <div style={{ padding: '80px 80px 80px 0', borderRight: '1px solid var(--sand)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', marginBottom: 28, lineHeight: 1.2 }}>
              Where it began
            </h2>
            <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 18 }}>
              One Silk Ribbon began with a simple frustration: the impossibility of finding a ribbon that felt truly beautiful — one that looked as considered as the gifts it was meant to adorn.
            </p>
            <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)', marginBottom: 18 }}>
              We started with a single bolt of Grade 6A mulberry silk and a pair of hands. Each ribbon is hand-torn along the grain of the fabric, creating a naturally frayed edge that no machine can replicate — a softness that speaks of how it was made.
            </p>
            <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)' }}>
              Today, One Silk Ribbon offers over 200 colourways across six collections — from luminous fine silks to deeply textured hand-frayed ribbons — all made with the same quiet care as that very first yard.
            </p>
          </div>
          <div style={{ padding: '80px 0 80px 80px' }}>
            <div style={{ aspectRatio: '4/5', overflow: 'hidden', background: 'var(--sand)' }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #E8DDD0 0%, #C4A882 100%)' }} />
            </div>
          </div>
        </div>

        {/* Section 2 — full width pull quote */}
        <div style={{ background: 'var(--sand)', borderTop: '1px solid var(--warm)', borderBottom: '1px solid var(--warm)', padding: '72px 60px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', maxWidth: 700, margin: '0 auto', lineHeight: 1.5 }}>
            &ldquo;We believe the ribbon is not an afterthought. It is the first thing you feel.&rdquo;
          </p>
        </div>

        {/* Section 3 — values */}
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '80px 60px 100px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', marginBottom: 56, textAlign: 'center' }}>
            What we stand for
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }} className="values-grid">
            {[
              {
                title: 'Craft',
                body: 'Every ribbon is hand-torn or hand-finished in our studio. We work slowly, because the details are everything.',
              },
              {
                title: 'Material',
                body: 'We use only Grade 6A mulberry silk — the highest classification available. The quality you feel in your hands is the quality we insist on.',
              },
              {
                title: 'Intention',
                body: 'We make ribbons for people who care about how things are given — for weddings, gifts, and the small rituals that make life beautiful.',
              },
            ].map(({ title, body }) => (
              <div key={title} style={{ paddingTop: 32, borderTop: '1px solid var(--sand)' }}>
                <p style={{ fontSize: 9, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>{title}</p>
                <p style={{ fontSize: 13, lineHeight: 2.1, color: 'var(--taupe)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        @media(max-width: 900px) {
          .about-grid { grid-template-columns: 1fr !important; padding: 0 24px !important; }
          .about-grid > div { padding: 48px 0 !important; border-right: none !important; border-bottom: 1px solid var(--sand); }
          .values-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </>
  )
}
