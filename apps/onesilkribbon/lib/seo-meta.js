// ── SERP 文案生成 ─────────────────────────────────────────────────────────────
// 原来的写法是 product.description.replace(/<[^>]+>/g, '').slice(0, 160)，
// 有三个问题：
//   1. 断在半个单词上——线上实测输出结尾是 "Crafted fr"
//   2. 商品描述第一行是「色号 | 品类名」，和 <title> 完全重复，白占 40 多个字符
//   3. 富文本里的换行原样进了 meta 标签，SERP 摘要里会出现突兀的断行
// 这里改成：按段落拆开 → 跳过与标题重复的首行 → 在句子或词边界收尾。

const NAMED_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
}

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, entity => NAMED_ENTITIES[entity.toLowerCase()] ?? ' ')
}

// 富文本 → 段落数组。块级标签和 <br> 都当换行处理，行内标签当空格，
// 这样 "Material：</span>100% silk" 不会粘成 "Material：100% silk" 之外的东西。
// 最后一步清掉标签替换后残留的「标点前空格」——<strong>x</strong>. 会变成 "x ."
export function toPlainParagraphs(raw) {
  if (!raw) return []
  return decodeEntities(
    String(raw)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim())
    .filter(Boolean)
}

// 判断某一段是不是标题的回声：短、且大部分词都在商品名里出现过。
// 例如 "Burgundy | Hand-Frayed Silk Satin Ribbon" 对
// "Burgundy Hand-Frayed Mulberry Silk Ribbon" 就是回声，摘进 description 毫无信息量。
function isTitleEcho(line, productName) {
  if (!productName) return false
  const words = line.toLowerCase().match(/[a-z0-9]+/g) || []
  if (words.length === 0 || words.length > 14) return false
  const nameWords = new Set(productName.toLowerCase().match(/[a-z0-9]+/g) || [])
  if (nameWords.size === 0) return false
  const overlap = words.filter(word => nameWords.has(word)).length / words.length
  return overlap >= 0.6
}

// 在句子边界收尾；句子本身超长就退回词边界。任何情况下都不把单词切成两半。
function truncateAtBoundary(text, max) {
  if (text.length <= max) return text
  const window = text.slice(0, max)
  const lastStop = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? ')
  )
  if (lastStop >= max * 0.55) return window.slice(0, lastStop + 1).trim()
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace <= 0) return window.trim()
  return window.slice(0, lastSpace).replace(/[\s,;:.–—-]+$/, '').trim()
}

export function buildMetaDescription(raw, { fallback = '', max = 155, productName = '' } = {}) {
  const paragraphs = toPlainParagraphs(raw)
  if (paragraphs.length === 0) return fallback

  // 优先拿「散文段落」当摘要开头：够长、带句读、不是标题回声。
  // 商品描述里通常混着 "✦ Craftsmanship"、"Material：..." 这类规格行，
  // 直接拼进去会让摘要读起来像一张参数表，而不是给人看的推荐语。
  const prose = paragraphs.filter(line =>
    line.length >= 60 && /[.!?]/.test(line) && !isTitleEcho(line, productName)
  )
  const usable = paragraphs.filter(line => !isTitleEcho(line, productName))

  const source = (prose.length > 0 ? prose : usable)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!source) return fallback
  return truncateAtBoundary(source, max) || fallback
}

