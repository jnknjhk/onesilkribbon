// 后台缩略图：上传的原图最长边 2000px、几百 KB 到 1MB 多，后台却大多只显示成 40～200px 的小图。
// 直接用原图时，打开媒体库（60 张）要下载约 30MB。这里改走 Next 自带的图片优化接口
// （/_next/image，前台商品图本来就在用）：按显示尺寸缩小、转成 AVIF/WebP，第一次生成后 Vercel 会缓存。
//
// 只处理 next.config.js 里 images.remotePatterns 允许的图片域名（两个站配置一致），
// 其它来源的图片原样显示——优化接口会拒绝没登记的域名。

// Next 默认允许的宽度（imageSizes + deviceSizes），请求别的宽度会被拒绝
const WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]

function optimizable(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const h = u.hostname
    return h.endsWith('.supabase.co') || h.endsWith('.supabase.in') || h === 'cdn.shopify.com'
  } catch {
    return false
  }
}

const fit = px => WIDTHS.find(w => w >= px) || WIDTHS[WIDTHS.length - 1]

export function imageUrl(url, displayWidth, quality = 75) {
  if (!url || !optimizable(url)) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${fit(displayWidth)}&q=${quality}`
}

// 1 倍屏和 2 倍屏（手机、Mac）各给一个尺寸，浏览器自己挑
export function imageSrcSet(url, displayWidth) {
  if (!url || !optimizable(url)) return undefined
  const a = fit(displayWidth), b = fit(displayWidth * 2)
  return a === b ? undefined : `${imageUrl(url, a)} 1x, ${imageUrl(url, b)} 2x`
}
