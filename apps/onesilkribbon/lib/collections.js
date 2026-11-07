// 全站系列目录的唯一配置源。
// 后台下拉、前台系列页、首页卡片、图片位置和 SEO 文案都从这里派生；
// 新增/改名系列只改这一个文件，然后重新部署。
export const COLLECTIONS = [
  {
    slug: 'fine-silk-ribbons',
    label: '精品丝带 Fine Silk Ribbons',
    shortName: 'Fine Silk Ribbons',
    homeCount: 'Ultra-Fine Silk',
    name: 'Fine Silk Ribbons',
    seoTitle: 'Fine Mulberry Silk Ribbon, 2mm–13mm for Crafts',
    desc: 'Fine mulberry silk ribbon in 2mm–13mm widths on 10m spools. Explore colours for ribbon embroidery, miniature clothing and detailed craft projects.',
    bg: 'linear-gradient(135deg,#D4C5B0,#9A8878)',
    homeBg: 'linear-gradient(160deg,#D4C5B0,#9A8878,#C4A882)',
    guideTitle: 'Choosing fine silk ribbon for detailed work',
    guidance: [
      'Our ultra-fine ribbon is supplied on 10m spools with width and colour options on the product page. Start with the scale of your project: a narrow accent on miniature clothing needs a different width from a larger bow or embroidered leaf. Measure the space before choosing.',
      'Check the selected width and colour together before adding a spool to your basket. For repeated motifs, make one test piece and measure how much ribbon it uses before estimating the full project. Photographs show the colour and finish; screens and lighting can change how a shade appears.',
    ],
  },
  {
    slug: 'hand-frayed-silk-ribbons',
    label: '手工磨边 Hand-Frayed',
    shortName: 'Hand-Frayed',
    homeCount: 'Hand-Torn & Textured',
    name: 'Hand-Frayed Silk Ribbons',
    seoTitle: 'Hand-Frayed Mulberry Silk Ribbon for Bouquets',
    journalSlug: 'silk-ribbon-for-bridal-bouquets-styling-guide',
    desc: 'Shop hand-frayed mulberry silk ribbons for bridal bouquets, invitations and gift wrapping. Compare colours, widths and lengths on each product page.',
    bg: 'linear-gradient(135deg,#E8C9B8,#9A7A66)',
    homeBg: 'linear-gradient(160deg,#E8C9B8,#C9A48A,#9A7A66)',
    guideTitle: 'Choosing ribbon for bouquets and invitations',
    guidance: [
      'A hand-frayed edge gives silk ribbon a softly textured outline. Compare the colour against the flowers, paper or fabric you will use, rather than choosing from a screen alone. Pearl white and champagne gold offer lighter options; burgundy and espresso brown bring deeper tones.',
      'For a bouquet, decide how much ribbon will wrap around the handle and how long you want the tails to hang. For invitations, tie one complete sample around the finished paper stack. Measure that sample, multiply by the number of pieces and allow extra ribbon for knots, trimming and test pieces.',
    ],
  },
  {
    slug: 'handcrafted-adornments',
    label: '手工饰品 Adornments',
    shortName: 'Adornments',
    homeCount: 'Handmade Accessories',
    name: 'Handcrafted Adornments',
    seoTitle: 'Handcrafted Silk Mini Bows & Embroidered Brooches',
    desc: 'Explore mulberry silk mini bows and handcrafted brooches with ribbon embroidery. Check each piece’s dimensions, materials and available options.',
    bg: 'linear-gradient(135deg,#B8A898,#4A3A30)',
    homeBg: 'linear-gradient(160deg,#B8A898,#7A6A5A,#4A3A30)',
    guideTitle: 'Small silk details, chosen for your project',
    guidance: [
      'This collection brings together ready-made silk mini bows and decorative brooches. Check the dimensions and photographs of the individual piece before choosing: a small bow for a delicate craft project and a brooch worn on clothing serve different purposes.',
      'Read the product description for the materials, finish and available options. If you need several matching pieces or want to discuss a custom project, contact the studio with the product name, quantity and date you need them.',
    ],
  },
  {
    slug: 'patterned-ribbons',
    label: '图案丝带 Patterned',
    shortName: 'Patterned',
    homeCount: 'Botanical & Geometric',
    name: 'Patterned Ribbons',
    seoTitle: 'Patterned Silk Ribbons',
    desc: 'Browse the patterned ribbon collection. New products will appear here when available.',
    bg: 'linear-gradient(135deg,#C8D4C0,#5A7050)',
    homeBg: 'linear-gradient(160deg,#C8D4C0,#8A9A80,#5A7050)',
    guidance: [],
  },
  {
    slug: 'studio-tools',
    label: '工作室工具 Studio Tools',
    shortName: 'Studio Tools',
    homeCount: "Maker's Essentials",
    name: 'Studio Tools',
    seoTitle: 'Wooden Ribbon Spools & Studio Tools',
    desc: 'Explore wooden ribbon spools for storing and presenting your ribbon. Check available sizes and product details before choosing.',
    bg: 'linear-gradient(135deg,#D0D0C8,#5A5A54)',
    homeBg: 'linear-gradient(160deg,#D0D0C8,#9A9A90,#5A5A54)',
    guideTitle: 'Choosing a spool for ribbon storage',
    guidance: [
      'A spool keeps a length of ribbon gathered together between projects. Compare the dimensions of the wooden spool with the width and length of the ribbon you want to store. Check the product details for the available options and what is included.',
      'Wind ribbon gently without pulling it tight. Keep stored ribbon away from moisture, strong light and heat. If you are assembling a gift or a project kit, check whether you are buying an empty spool or ribbon supplied on a spool; these are different products.',
    ],
  },
  {
    slug: 'vintage-inspired-ribbons',
    label: '复古系列 Vintage-Inspired',
    shortName: 'Vintage-Inspired',
    homeCount: 'Antique-Inspired',
    name: 'Vintage-Inspired Ribbons',
    seoTitle: '10mm Vintage Crinkle Silk Ribbon on Wooden Spools',
    desc: 'Explore 10mm crinkle mulberry silk ribbon on wooden spools. Compare available colours for gift wrapping, stationery and decorative craft projects.',
    bg: 'linear-gradient(135deg,#D4B8C0,#5A3A44)',
    homeBg: 'linear-gradient(160deg,#D4B8C0,#9A7A84,#5A3A44)',
    guideTitle: 'Working with crinkle silk ribbon',
    guidance: [
      'The 10mm crinkle ribbon has a textured appearance that differs from a flat ribbon. Use the product photographs to compare the finish and available colours with the paper, fabric or other materials in your project.',
      'Make a sample bow or wrap before planning a larger quantity. Measure the ribbon used in that sample, including the knot and tails, and check the listed length of the selected option. For storage and gentle handling, see our silk care guide.',
    ],
  },
]

export const COLLECTION_SLUGS = COLLECTIONS.map(collection => collection.slug)

export const COLLECTION_META = Object.fromEntries(
  COLLECTIONS.map(({ slug, label, shortName, homeCount, homeBg, ...meta }) => [slug, meta])
)
