import Image from 'next/image'
import Link from 'next/link'
import { Fragment } from 'react'
import { journalInlineParts, journalSections, journalTextBlocks } from '@/lib/journal-text'
import styles from './HalloweenArticle.module.css'

const collection = 'https://onesilkribbon.com/collections/hand-frayed-silk-ribbons'
const brooch = 'https://onesilkribbon.com/collections/handcrafted-adornments/handcrafted-gold-silk-pumpkin-brooch-with-ribbon-embroidery-coquette-cottagecore-floral-pin'
const palette = [
  { name: 'Burgundy', note: 'A rich, autumn accent', slug: 'burgundy', image: 'burgundy', colour: '#7a2335' },
  { name: 'Espresso Brown', note: 'Warm, earthy depth', slug: 'espresso', image: 'espresso', colour: '#49372d' },
  { name: 'Champagne Gold', note: 'A soft touch of light', slug: 'champagne-gold-hand-frayed-silk-ribbon', image: 'champagne', colour: '#c2a36d' },
]

function InlineText({ text }) {
  return journalInlineParts(text).map((part, i) => part.href
    ? <a key={i} href={part.href}>{part.text}</a> : <Fragment key={i}>{part.text}</Fragment>)
}

function TextBlocks({ text, tip = false }) {
  const blocks = journalTextBlocks(text)
  return blocks.map((block, i) => block.type === 'quote'
    ? <blockquote key={i} className={styles.measure}>{block.lines.map((line, j) => j === 0
      ? <span key={j} className={styles.eyebrow}><InlineText text={line} /></span>
      : j === 1 ? <p key={j}><InlineText text={line} /></p>
        : <small key={j}><InlineText text={line} /></small>)}</blockquote>
    : <p key={i} className={tip && i === blocks.length - 1 ? styles.tip : undefined}><InlineText text={block.text} /></p>)
}

export default function HalloweenArticle({ post, preview = false }) {
  const sections = journalSections(post)
  const contents = sections.filter(section => section.type !== 'image' && section.heading)
  const colon = post.title.indexOf(':')
  const heading = colon < 0 ? post.title : post.title.slice(0, colon + 1)
  const subheading = colon < 0 ? '' : post.title.slice(colon + 1).trim()
  const date = post.published_at && new Date(post.published_at)
  const editionDate = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

  return (
    <main className={styles.page} id="article-top">
      {preview && <div className={styles.preview}>Article preview <span>·</span> One Silk Ribbon Journal</div>}
      <div className={styles.breadcrumb}><Link href="/journal">The Journal</Link><span>/</span><span>{post.category}</span></div>
      <header className={`${styles.hero} ${!post.cover_image ? styles.heroNoImage : ''}`}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span /> THE AUTUMN EDIT{editionDate && ` · ${editionDate}`}</div>
          <h1>{heading}{subheading && <><br /><em>{subheading}</em></>}</h1>
          {post.excerpt && <p>{post.excerpt}</p>}
          <div className={styles.heroMeta}><span>By One Silk Ribbon</span>{post.read_time && <span>{post.read_time}</span>}</div>
          <a className={styles.readLink} href="#story">Explore the ideas <span aria-hidden="true">↓</span></a>
        </div>
        {post.cover_image && <figure className={styles.heroFigure}>
          <div className={styles.heroImage}><Image src={post.cover_image} alt={post.title} fill priority sizes="(max-width: 760px) 100vw, 52vw" /></div>
          <figcaption><span>{post.category}</span><span>ONE SILK RIBBON JOURNAL</span></figcaption>
        </figure>}
      </header>

      <div className={styles.storyLayout} id="story">
        <aside className={styles.sidebar}>
          <nav aria-label="In this article"><p className={styles.eyebrow}>IN THIS ARTICLE</p>{contents.map((section, i) => <a key={section.id} href={`#${section.id}`}><span>{String(i + 1).padStart(2, '0')}</span>{section.heading}</a>)}</nav>
          <div className={styles.sidebarNote}><span className={styles.smallRule} /><p>Start with one project.<br />Let the colour<br /><em>bring it together.</em></p></div>
        </aside>
        <article className={styles.article}>
          {post.intro && <div className={styles.intro}><TextBlocks text={post.intro} /></div>}
          {sections.map(section => section.type === 'image'
            ? <figure key={section.id} id={section.id} className={styles.articleFigure}><div><Image src={section.url} alt={section.caption || post.title} fill sizes="(max-width: 760px) 100vw, 670px" /></div>{section.caption && <figcaption>{section.caption}</figcaption>}</figure>
            : <section key={section.id} id={section.id} className={styles.section}>
              {section.kicker && <div className={styles.sectionKicker}>{section.kicker}</div>}
              {section.heading && <h2>{section.heading}</h2>}
              <TextBlocks text={section.body || ''} tip={section.id === 'palette'} />
              {section.id === 'palette' && <div className={styles.swatches}>{palette.map(item => <a key={item.slug} href={`${collection}/${item.slug}`}><span style={{ background: item.colour }} /><span>{item.name}</span><span aria-hidden="true">↗</span></a>)}</div>}
              {section.id === 'wear' && <a className={styles.broochCard} href={brooch}><div><Image src="/images/journal/halloween/pumpkin-brooch.jpg" alt="Gold silk pumpkin brooch with ribbon embroidery" fill sizes="(max-width: 500px) 100vw, 180px" /></div><span><small>HANDCRAFTED ADORNMENTS</small><strong>A little pumpkin, to keep.</strong><span>Discover the brooch <span aria-hidden="true">↗</span></span></span></a>}
            </section>)}
          {post.closing && <div className={styles.closing}><TextBlocks text={post.closing} /></div>}
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
