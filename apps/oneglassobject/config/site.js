/**
 * 站点级配置——品牌名、域名、联系邮箱、货币、系列列表都集中在这里。
 *
 * 以后再开新站，绝大部分"改品牌"的工作就是复制这个文件改内容，
 * 而不是去几十个页面里一个个找替换。
 */

export const site = {
  name:      'One Glass Object',
  shortName: 'OGO',
  domain:    'oneglassobject.com',
  // 本地开发时读 .env.local 的 NEXT_PUBLIC_SITE_URL，线上回退到正式域名
  url:       process.env.NEXT_PUBLIC_SITE_URL || 'https://oneglassobject.com',
  // 客服 / 询价收件邮箱
  email:     'hello@oneglassobject.com',
  // 订单号前缀，形如 OGO-2026-0001
  orderPrefix: 'OGO',
  currency:       'GBP',
  currencySymbol: '£',
  tagline: 'Hand-blown glass objects for everyday rituals.',
}

/**
 * 商品系列。
 *
 * ⚠️ 下面四个系列是占位内容，等你定好玻璃器物实际分几类之后改这里。
 *    改完之后，前台导航、页脚、系列总览页、单个系列页、sitemap、
 *    后台商品编辑的下拉框，全都会同步更新，不需要再去别的文件里找。
 *
 *   slug        URL 里那一段，同时是数据库 products.collection 存的值
 *   name        前台显示的英文名
 *   count       卡片上那行小字标语
 *   adminLabel  后台下拉框里显示的名字（可以带中文，方便你自己认）
 *   desc        系列页顶部和总览页卡片上的介绍文案
 *   bg          还没上传系列图时，卡片显示的渐变色占位背景
 */
export const COLLECTIONS = [
  {
    slug: 'drinking-glasses',
    name: 'Drinking Glasses',
    count: 'Blown by Breath',
    adminLabel: '杯具 Drinking Glasses',
    desc: 'Hand-blown tumblers, wine glasses and cups — each one shaped by breath, so no two are quite alike.',
    bg: 'linear-gradient(160deg,#D6DEE0,#9BAAB0,#6B7C84)',
  },
  {
    slug: 'vases',
    name: 'Vases',
    count: 'Single Stem to Full Bloom',
    adminLabel: '花器 Vases',
    desc: 'Sculptural vessels for a single stem or a full arrangement, in clear and softly tinted glass.',
    bg: 'linear-gradient(160deg,#E0DCD2,#B0A899,#7A7264)',
  },
  {
    slug: 'bowls-and-plates',
    name: 'Bowls & Plates',
    count: 'For the Table',
    adminLabel: '盘碗 Bowls & Plates',
    desc: 'Serving pieces for the table — warm, tactile and made to be used every day.',
    bg: 'linear-gradient(160deg,#E6D8C8,#C0A88C,#8A7258)',
  },
  {
    slug: 'lighting',
    name: 'Lighting',
    count: 'Light, Held',
    adminLabel: '灯具 Lighting',
    desc: 'Shades, votives and pendants that turn light into something you can almost touch.',
    bg: 'linear-gradient(160deg,#EDE2CE,#CDB68C,#96794E)',
  },
]

export const COLLECTION_SLUGS = COLLECTIONS.map(c => c.slug)

export const COLLECTION_META = Object.fromEntries(
  COLLECTIONS.map(c => [c.slug, { name: c.name, desc: c.desc }])
)

export const COLLECTION_BG = Object.fromEntries(
  COLLECTIONS.map(c => [c.slug, c.bg])
)

export function collectionName(slug) {
  return COLLECTIONS.find(c => c.slug === slug)?.name || slug
}
