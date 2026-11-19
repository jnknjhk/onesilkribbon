export const FINE_SILK_CONTENT_UPDATED_AT = '2026-11-19'

const colourNotes = {
  black: 'Use Black mulberry silk ribbon for contrasting outlines on pale fabric, miniature waist sashes or tiny bows. Try a 2mm width for fine details.',
  'cool-lavender': 'Use Cool Lavender silk ribbon with silvery thread for small iris or lilac motifs. Try 4mm for petals and a narrow green ribbon for stems.',
  'soft-lavender': 'Use Soft Lavender silk ribbon for wisteria-style clusters or a small bow on a cream doll dress. Pair it with a deeper purple thread for definition.',
  'deep-blue-grey': 'Use Deep Blue Grey silk ribbon for miniature jacket trim or darker petals in an embroidery motif. Set it against pale blue to keep fine detail visible.',
  'blue-grey': 'Use Blue Grey silk ribbon for cool-toned leaf motifs or muted trim on linen. A 4mm ribbon leaves room for stitching around small shapes.',
  'soft-lake-blue': 'Use Soft Lake Blue silk ribbon in a blue-and-green embroidery palette or tie it around miniature sailor collars. Try 4mm for a small bow.',
  'pale-blue': 'Use Pale Blue silk ribbon for tiny forget-me-not petals or bows on cream fabric. Try a small stitched sample to judge the contrast before cutting.',
  'distant-mountain-blue': 'Use Distant Mountain Blue silk ribbon for a darker band in a layered blue design. Try it alongside Light Mist Blue to create depth in a small motif.',
  'light-mist-blue': 'Use Light Mist Blue silk ribbon for small bows or pale highlights in blue floral embroidery. Try it on a darker backing to see the shape clearly.',
  'vintage-green': 'Use Vintage Green silk ribbon for foliage alongside dusty pink flowers or as understated trim on doll clothing. Try 7mm for a wider leaf.',
  'meadow-green': 'Use Meadow Green silk ribbon for leaves and stems in floral embroidery. Try 2mm for narrow stems and 7mm for leaves with a more visible surface.',
  'young-grass-green': 'Use Young Grass Green silk ribbon for new shoots and leaf tips. Work it next to a deeper green so the two shades read separately in a small design.',
  'fresh-mint-green': 'Use Fresh Mint Green silk ribbon for small bows on white fabric or as a cool accent in a pastel wreath. Try 4mm for a narrow trim.',
  'mint-green': 'Use Mint Green silk ribbon for fine stripes on miniature clothing or pastel leafy details. Compare it against lilac fabric before choosing a thread.',
  'soft-green': 'Use Soft Green silk ribbon for small leaves around cream or pink flowers. Try 4mm for foliage that stays in proportion to a miniature motif.',
  'chocolate-brown': 'Use Chocolate Brown silk ribbon for branches, seed heads or small bows on cream linen. A narrow width works well between closely spaced stitches.',
  'golden-goose': 'Use Golden Goose silk ribbon for golden flower centres, autumn embroidery or a small warm-toned bow. Pair it with brown thread for detail.',
  'berry-red': 'Use Berry Red silk ribbon for berries, rosebuds or a small bow on dark green fabric. Try 4mm for compact details and 7mm for a fuller shape.',
  'grapefruit-pink': 'Use Grapefruit Pink silk ribbon for citrus-toned flower details or a lively accent on pale doll clothing. Stitch a sample next to peach or cream.',
  'peach-sorbet': 'Use Peach Sorbet silk ribbon for warm petals or small bows on ivory fabric. Pair it with a deeper pink to distinguish petal edges.',
  'dusty-pink': 'Use Dusty Pink silk ribbon in a muted rose palette or for bows on vintage-style doll clothing. Try it alongside Vintage Green for small leaves.',
  'wild-rose': 'Use Wild Rose silk ribbon for rosebuds or petals in a two-tone floral motif. Work a few stitches beside a paler pink to judge the contrast.',
  'mauve-pink': 'Use Mauve Pink silk ribbon for violet-leaning floral colour combinations or a trim against grey fabric. Try 7mm for broad petal loops.',
  'sakura-pink': 'Use Sakura Pink silk ribbon for cherry blossom petals or spring accents on miniature clothes. Start with 4mm for small clusters of petals.',
  'soft-pink': 'Use Soft Pink silk ribbon for tonal bows and small petals on pale fabric. A slightly darker thread can help the centre of a motif stand out.',
  'light-pink': 'Use Light Pink silk ribbon for tiny bows or highlights in a pink floral design. Try 2mm for a narrow accent along a miniature seam.',
  'whisper-pink': 'Use Whisper Pink silk ribbon for subtle details on cream fabric or pale transitions between petals. Check it in daylight if you need a close match.',
  'creamy-beige': 'Use Creamy Beige silk ribbon for warm neutral trim, tiny bows or tonal embroidery on linen. Compare it with ivory and white under the same light.',
  'cloud-white': 'Use Cloud White silk ribbon for white-on-white embroidery, miniature collars or small bows. Compare it with Creamy Beige if matching ivory fabric.',
}

const prefix = 'mulberry-silk-ribbon-'

export function fineSilkColourNote(collection, slug) {
  if (collection !== 'fine-silk-ribbons' || !slug.startsWith(prefix)) return undefined
  const colour = slug.slice(prefix.length)
  return Object.hasOwn(colourNotes, colour) ? colourNotes[colour] : undefined
}
