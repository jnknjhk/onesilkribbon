import Link from 'next/link'

export const metadata = {
  title: 'Choosing Silk Ribbon: Width, Edge & Project Length',
  description: 'Choose silk ribbon for embroidery, miniature crafts, bouquets and invitations. Compare widths and finishes, then estimate the length for your project.',
  alternates: { canonical: '/ribbon-guide' },
  openGraph: {
    title: 'Choosing Silk Ribbon | One Silk Ribbon',
    description: 'A practical guide to ribbon width, edge finish, colour and measuring a sample before you buy.',
    url: 'https://onesilkribbon.com/ribbon-guide',
    type: 'website',
    images: ['/og-image.jpg'],
  },
}

const choices = [
  { title: 'Embroidery and miniature clothing', href: '/collections/fine-silk-ribbons', label: 'Fine silk ribbon',
    text: 'For a small motif, narrow trim or a bow on miniature clothing, start by measuring the area you want to cover. Our fine mulberry silk ribbon comes in 2mm–13mm widths on 10m spools. Compare the selected width with your project rather than judging scale from a close-up photograph.' },
  { title: 'Bouquets, invitations and wrapping', href: '/collections/hand-frayed-silk-ribbons', label: 'Hand-frayed silk ribbon',
    text: 'A hand-frayed edge gives a softly textured outline. When choosing for a bouquet, consider the width of the handle, the size of the arrangement and how long the ribbon tails should hang. For stationery, make a sample around the complete paper stack, including any envelope or finishing details.' },
  { title: 'Textured bows and decorative details', href: '/collections/vintage-inspired-ribbons', label: 'Vintage-inspired ribbon',
    text: 'If you want a crinkled finish, compare the 10mm crinkle silk ribbon with the flatter styles in the other collections. Look at the product photographs and selected colour together. Texture changes the appearance of a bow, so test the shape before cutting several lengths.' },
]

export default function RibbonGuide() {
  return (
    <article className="ribbon-guide-page">
      <header>
        <p className="eyebrow">A practical starting point</p>
        <h1>How to choose <em>silk ribbon</em></h1>
        <p>Start with what you are making. Width, edge finish and the length used in one sample are more useful than choosing by colour alone. Use this guide to narrow the options, then check the exact specifications on the product page.</p>
      </header>

      <section aria-labelledby="guide-project">
        <h2 id="guide-project">1. Match the ribbon to the project</h2>
        <div className="ribbon-guide-choices">
          {choices.map(choice => (
            <section key={choice.href}>
              <h3>{choice.title}</h3>
              <p>{choice.text}</p>
              <Link href={choice.href}>{choice.label} →</Link>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="guide-length">
        <h2 id="guide-length">2. Measure a complete sample</h2>
        <p>There is no single ribbon length that suits every bouquet or invitation. Tie one bow or finish one piece in the way you intend to use it, then untie it and measure the ribbon. Include the knot, wrap and tails. For embroidery, measure the length used for one finished motif.</p>
        <p>Multiply that measurement by the number of pieces you are making, then allow extra for test pieces, trimming and mistakes. For example, a sample using 0.4m for each of 25 invitations needs 10m before any allowance. This is a calculation example, not a recommended length for every invitation.</p>
        <p>Check the length listed for the selected product option. Width and length are different measurements: a 10mm-wide ribbon is not necessarily supplied in a 10m length.</p>
      </section>

      <section aria-labelledby="guide-colour">
        <h2 id="guide-colour">3. Compare colour with your materials</h2>
        <p>Look at the ribbon alongside your flowers, paper or fabric in the lighting where the finished piece will be used. A colour name is a starting point; screen settings and lighting can change its appearance. If colour matching is important, contact us about your project before placing a larger order.</p>
      </section>

      <section aria-labelledby="guide-check">
        <h2 id="guide-check">4. Check the selected option before ordering</h2>
        <ul>
          <li>Confirm the colour, width, length and quantity shown on the product page.</li>
          <li>Read the description for the material and finish of that specific product.</li>
          <li>For wooden spools, check whether ribbon is included or the spool is sold separately.</li>
          <li>Check delivery information against the date you need the materials.</li>
        </ul>
        <nav className="ribbon-guide-links" aria-label="More ribbon help">
          <Link href="/collections">Browse collections</Link>
          <Link href="/care-guide">Caring for silk ribbon</Link>
          <Link href="/shipping-returns">Delivery information</Link>
          <Link href="/contact">Ask about your project</Link>
        </nav>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .ribbon-guide-page { padding: 120px var(--page-padding) 80px; max-width: 1120px; margin: 0 auto; overflow-wrap: anywhere; }
        .ribbon-guide-page header { max-width: 780px; margin-bottom: 48px; }
        .ribbon-guide-page h1 { font-size: clamp(36px, 5vw, 56px); margin: 20px 0 28px; }
        .ribbon-guide-page h2 { font-size: clamp(26px, 3vw, 34px); margin-bottom: 24px; }
        .ribbon-guide-page h3 { font-size: 23px; line-height: 1.3; margin-bottom: 16px; }
        .ribbon-guide-page p, .ribbon-guide-page li { font-size: 16px; line-height: 1.9; color: var(--deep); margin-bottom: 16px; }
        .ribbon-guide-page > section { padding: 32px 0; border-top: 1px solid var(--sand); }
        .ribbon-guide-page ul { padding-left: 22px; }
        .ribbon-guide-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
        .ribbon-guide-page a { display: inline-flex; align-items: center; min-height: 44px; text-decoration: underline; text-underline-offset: 4px; }
        .ribbon-guide-links { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 24px; }
        @media (max-width: 768px) { .ribbon-guide-page { padding-top: 100px; } .ribbon-guide-choices { grid-template-columns: minmax(0, 1fr); gap: 32px; } }
      ` }} />
    </article>
  )
}
