import Image from 'next/image'
import styles from './HalloweenArticle.module.css'

const collection = 'https://onesilkribbon.com/collections/hand-frayed-silk-ribbons'
const brooch = 'https://onesilkribbon.com/collections/handcrafted-adornments/handcrafted-gold-silk-pumpkin-brooch-with-ribbon-embroidery-coquette-cottagecore-floral-pin'
const palette = [
  { name: 'Burgundy', note: 'A rich, autumn accent', slug: 'burgundy', image: 'burgundy', colour: '#7a2335' },
  { name: 'Espresso Brown', note: 'Warm, earthy depth', slug: 'espresso', image: 'espresso', colour: '#49372d' },
  { name: 'Champagne Gold', note: 'A soft touch of light', slug: 'champagne-gold-hand-frayed-silk-ribbon', image: 'champagne', colour: '#c2a36d' },
]
const contents = [
  ['palette', 'The autumn palette'],
  ['pumpkin', 'A bow for a pumpkin'],
  ['table', 'A thoughtful table'],
  ['gifts', 'Little autumn gifts'],
  ['wear', 'A detail to wear'],
  ['reuse', 'Beyond Halloween'],
]

export default function HalloweenArticle({ preview = false }) {
  return (
    <main className={styles.page} id="article-top">
      {preview && <div className={styles.preview}>Article preview <span>·</span> One Silk Ribbon Journal</div>}
      <div className={styles.breadcrumb}><a href="https://onesilkribbon.com/journal">The Journal</a><span>/</span><span>Seasonal styling</span></div>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span /> THE AUTUMN EDIT · OCTOBER 2026</div>
          <h1>Halloween ribbon ideas:<br /><em>bows, pumpkins<br />&amp; autumn colours.</em></h1>
          <p>A little silk. A warm autumn palette. Thoughtful details for your home, your gifts and the things you wear.</p>
          <div className={styles.heroMeta}><span>By One Silk Ribbon</span><span>4 min read</span></div>
          <a className={styles.readLink} href="#story">Explore the ideas <span aria-hidden="true">↓</span></a>
        </div>
        <figure className={styles.heroFigure}>
          <div className={styles.heroImage}><Image src="/images/journal/halloween/pumpkin-brooch.jpg" alt="A hand holding a gold silk pumpkin brooch with embroidered leaves and small flowers" fill priority sizes="(max-width: 760px) 100vw, 52vw" /></div>
          <figcaption><span>A LITTLE AUTUMN DETAIL</span><a href={brooch}>The gold silk pumpkin brooch <span aria-hidden="true">↗</span></a></figcaption>
        </figure>
      </header>

      <div className={styles.storyLayout} id="story">
        <aside className={styles.sidebar}>
          <nav aria-label="In this article"><p className={styles.eyebrow}>IN THIS ARTICLE</p>{contents.map(([id, label], i) => <a key={id} href={`#${id}`}><span>0{i + 1}</span>{label}</a>)}</nav>
          <div className={styles.sidebarNote}><span className={styles.smallRule} /><p>Start with one project.<br />Let the colour<br /><em>bring it together.</em></p></div>
        </aside>

        <article className={styles.article}>
          <div className={styles.intro}>
            <p>A burgundy bow around a pale pumpkin. Espresso ribbon against brown paper. A small gold pumpkin pinned to a favourite jacket. A few well-chosen details can give Halloween its own place in your home and wardrobe, while working with the autumn colours you already enjoy.</p>
            <p>Silk ribbon brings movement to these arrangements: loose tails can fall over the edge of a basket, frame a place card or soften the shape of a small gift. Start with one project and a limited palette, then carry the same colours through the rest of your setting.</p>
          </div>

          <section id="palette" className={styles.section}>
            <div className={styles.sectionKicker}>THE COLOURS</div>
            <h2>Choose an autumn ribbon palette</h2>
            <p>Try <a href={`${collection}/burgundy`}>Burgundy hand-frayed silk ribbon</a> alongside cream paper, pale pumpkins and dark foliage. Its deeper colour gives a small bow a clear place in the arrangement.</p>
            <p><a href={`${collection}/espresso`}>Espresso Brown</a> works with kraft packaging, wooden surfaces and dried stems. Add <a href={`${collection}/champagne-gold-hand-frayed-silk-ribbon`}>Champagne Gold</a> where you want a lighter accent.</p>
            <div className={styles.swatches}>{palette.map(item => <a key={item.slug} href={`${collection}/${item.slug}`}><span style={{ background: item.colour }} /><span>{item.name}</span><span aria-hidden="true">↗</span></a>)}</div>
            <p className={styles.tip}>Lay your ribbon beside the actual materials before making a final choice. Paper, flowers and lighting all affect how a colour looks within a setting.</p>
          </section>

          <section id="pumpkin" className={styles.section}>
            <div className={styles.sectionKicker}>IDEA 01 · AT HOME</div>
            <h2>Tie a ribbon bow around a pumpkin stem</h2>
            <p>Choose a decorative pumpkin with a firm, accessible stem. Loop the ribbon gently around it and tie a simple bow without pulling hard on the stem.</p>
            <p>Adjust the loops first, then let the tails fall along the pumpkin. A shorter bow suits a small place setting; longer tails give a larger pumpkin more movement on a side table. Leave enough ribbon to loosen the knot when the display comes down.</p>
            <p>For a group of pumpkins, repeat one ribbon colour across different sizes. Vary the bow proportions to suit each pumpkin.</p>
          </section>

          <section id="table" className={styles.section}>
            <div className={styles.sectionKicker}>IDEA 02 · GATHER TOGETHER</div>
            <h2>Add a ribbon detail to the Halloween table</h2>
            <p>Wrap ribbon around a folded napkin and tuck a place card beneath the knot. Keep the bow small enough to leave room for the name, and position it where guests can easily untie it.</p>
            <p>Carry the same ribbon into a small vase of autumn stems or around a basket used for the centrepiece. If your arrangement includes lights, choose battery-operated LED candles and leave the ribbon clear of their fittings.</p>
          </section>

          <section id="gifts" className={styles.section}>
            <div className={styles.sectionKicker}>IDEA 03 · GIVE SOMETHING SMALL</div>
            <h2>Wrap a small autumn gift</h2>
            <p>Brown paper, a handwritten tag and an espresso or burgundy bow make a thoughtful wrapper for a host gift. For Halloween treats, tie the ribbon around a closed paper box or sealed bag, keeping it outside the food packaging.</p>
            <p>Make one complete sample before cutting ribbon for several parcels. Measure the piece after tying the bow you want.</p>
            <div className={styles.measure}><span className={styles.eyebrow}>A LITTLE PLANNING</span><p>60 cm <span>×</span> 8 parcels <span>=</span> <strong>4.8 m</strong></p><small>Base requirement only. Allow extra for practice pieces and trimming.</small></div>
            <p>Our <a href="https://onesilkribbon.com/ribbon-guide">ribbon width and length guide</a> offers more help with planning a project.</p>
          </section>

          <section id="wear" className={styles.section}>
            <div className={styles.sectionKicker}>IDEA 04 · TAKE AUTUMN WITH YOU</div>
            <h2>Wear a small pumpkin detail</h2>
            <p>The <a href={brooch}>Gold Silk Pumpkin Brooch with Ribbon Embroidery</a> gives an autumn outfit a clear seasonal detail. Try it on a lapel or a fabric bag, checking that the material is suitable for a brooch fastening.</p>
            <p>For a separate ribbon accent, tie a small bow around a bag handle and keep the tails short enough to stay out of the way. Repeating a colour from your table or gift wrapping can bring the whole celebration together.</p>
            <a className={styles.broochCard} href={brooch}><div><Image src="/images/journal/halloween/pumpkin-brooch.jpg" alt="Gold silk pumpkin brooch with ribbon embroidery" fill sizes="(max-width: 500px) 100vw, 180px" /></div><span><small>HANDCRAFTED ADORNMENTS</small><strong>A little pumpkin, to keep.</strong><span>Discover the brooch <span aria-hidden="true">↗</span></span></span></a>
          </section>

          <section id="reuse" className={styles.section}>
            <div className={styles.sectionKicker}>AFTER THE CELEBRATION</div>
            <h2>Keep the ribbon for your next project</h2>
            <p>After Halloween, gently untie the bows and put clean, dry ribbon aside for another project. Burgundy, espresso brown and champagne gold can continue into autumn gift wrapping or a seasonal bouquet.</p>
            <p>Choose one idea to begin with, make a sample and adjust it to your own setting.</p>
          </section>
          <div className={styles.articleEnd}><span>ONE SILK RIBBON</span><a href="#article-top">Back to top ↑</a></div>
        </article>
      </div>

      <section className={styles.shop} aria-labelledby="palette-heading">
        <div className={styles.shopHeading}><div><p className={styles.eyebrow}>BRING THE PALETTE HOME</p><h2 id="palette-heading">Three shades of <em>autumn.</em></h2></div><a href={collection}>Explore all silk ribbons <span aria-hidden="true">↗</span></a></div>
        <div className={styles.productGrid}>{palette.map(item => <a className={styles.product} key={item.slug} href={`${collection}/${item.slug}`}><div className={styles.productImage}><Image src={`/images/journal/halloween/${item.image}.jpg`} alt={`${item.name} hand-frayed silk ribbon on a wooden spool`} fill sizes="(max-width: 600px) 100vw, 33vw" /></div><div className={styles.productTitle}><h3>{item.name}</h3><span aria-hidden="true">↗</span></div><p>{item.note}</p></a>)}</div>
      </section>
    </main>
  )
}
