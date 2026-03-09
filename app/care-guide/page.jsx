export const metadata = {
  title: 'Silk Care Guide — One Silk Ribbon',
  description: 'How to wash, iron, store and handle your One Silk Ribbon mulberry silk ribbons.',
}

const sections = [
  {
    title: 'Washing',
    steps: [
      { heading: 'Hand wash only', body: 'Fill a clean basin with cool water (under 30°C) and a small amount of gentle detergent — ideally one formulated for delicates or silk. Never use biological detergents or bleach.' },
      { heading: 'Submerge gently', body: 'Place the ribbon in the water and swirl softly. Do not scrub, wring, or twist. Allow to soak for no more than 5 minutes.' },
      { heading: 'Rinse carefully', body: 'Rinse under cool running water until the water runs clear. Support the full length of the ribbon — do not let it hang under its own weight while wet.' },
    ],
  },
  {
    title: 'Drying',
    steps: [
      { heading: 'Do not wring', body: 'Gently press the ribbon between two clean towels to remove excess water. Never wring or twist.' },
      { heading: 'Lay flat to dry', body: 'Lay the ribbon flat on a clean dry towel, away from direct sunlight and heat sources. Sunlight can fade natural dyes over time.' },
      { heading: 'Reshape while damp', body: 'While still slightly damp, gently smooth the ribbon flat with your fingers to maintain its shape.' },
    ],
  },
  {
    title: 'Ironing',
    steps: [
      { heading: 'Use a low silk setting', body: 'Set your iron to the lowest temperature (silk or delicate setting). High heat will damage the fibres and flatten the natural sheen.' },
      { heading: 'Always use a pressing cloth', body: 'Place a clean cotton cloth between the iron and the ribbon. Never iron silk directly — it can cause irreversible shine marks or scorching.' },
      { heading: 'Iron on the reverse', body: 'Where possible, iron on the matte reverse side of the ribbon to protect the lustrous front surface.' },
    ],
  },
  {
    title: 'Storage',
    steps: [
      { heading: 'Roll, don\'t fold', body: 'Store ribbons rolled around a spool or tube rather than folded, to prevent permanent crease lines in the silk.' },
      { heading: 'Keep away from light and moisture', body: 'Store in a cool, dry place away from direct sunlight and humidity. A linen bag or acid-free tissue works well for long-term storage.' },
      { heading: 'Avoid contact with chemicals', body: 'Keep ribbons away from perfume, hairspray, and household chemicals, which can permanently stain or degrade silk fibres.' },
    ],
  },
]

export default function CareGuide() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--sand)', padding: '80px 60px 72px', maxWidth: 1360, margin: '0 auto' }}>
          <p style={{ fontSize: 9, letterSpacing: '.38em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Care</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300, lineHeight: 1.08, color: 'var(--ink)', maxWidth: 560 }}>
            How to care for<br /><em>your silk ribbon.</em>
          </h1>
        </div>

        {/* Intro */}
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '56px 60px 0' }} className="care-pad">
          <p style={{ fontSize: 13, lineHeight: 2.2, color: 'var(--taupe)' }}>
            Mulberry silk is a natural protein fibre — lustrous, strong, and responsive to how it is handled. With a little care, your ribbon will keep its sheen and softness indefinitely. These guidelines apply to all One Silk Ribbon products.
          </p>
        </div>

        {/* Sections */}
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '64px 60px 120px' }} className="care-pad">
          {sections.map(({ title, steps }) => (
            <div key={title} style={{ marginBottom: 64 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)', marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid var(--sand)' }}>{title}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {steps.map(({ heading, body }, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 20, alignItems: 'start' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--gold)', paddingTop: 2 }}>{i + 1}</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink)', marginBottom: 6, letterSpacing: '.03em' }}>{heading}</p>
                      <p style={{ fontSize: 13, lineHeight: 2.1, color: 'var(--taupe)' }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Quick reference box */}
          <div style={{ background: 'var(--sand)', padding: '36px 40px', borderTop: '2px solid var(--warm)' }}>
            <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20 }}>Quick Reference</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px' }}>
              {[
                ['Wash', 'Cool hand wash only'],
                ['Detergent', 'Gentle / silk-specific'],
                ['Dry', 'Flat, away from sunlight'],
                ['Iron', 'Low heat, pressing cloth'],
                ['Store', 'Rolled, cool and dry'],
                ['Avoid', 'Bleach, heat, perfume'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--warm)', fontSize: 12 }}>
                  <span style={{ color: 'var(--taupe)', minWidth: 60, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', paddingTop: 2 }}>{k}</span>
                  <span style={{ color: 'var(--ink)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @media(max-width: 768px) {
          .care-pad { padding-left: 24px !important; padding-right: 24px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </>
  )
}
