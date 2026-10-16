// 登录前后的跳转目标（?next=）只能是本站的相对路径。
//
// next 来自 URL，任何人都能构造。之前登录页、/auth/confirm 和 /api/auth/callback
// 都直接拿它跳转：
//   · next=javascript:...  → Next 14 的 router.replace() 会把它当外部地址交给
//     location.replace()，脚本在本站域名下执行。已登录的人（包括管理员）点开链接
//     就会中招，而脚本能以他的身份调用全部 /api/admin 接口。
//   · next=https://外站 或 next=.evil.com（拼在 origin 后面变成 onesilkribbon.com.evil.com）
//     → 刚登录完就被送到钓鱼站。
//
// 浏览器解析 URL 时会去掉制表符/换行、把 \ 当成 /，所以不能只看字符串开头，
// 这里用 URL 解析器按浏览器的规则算一遍，解析后 origin 变了就拒绝。
const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid'

function relativePath(next) {
  if (typeof next !== 'string' || next.length > 4096 || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) return null
  try {
    const url = new URL(next, PLACEHOLDER_ORIGIN)
    if (url.origin !== PLACEHOLDER_ORIGIN || url.pathname.startsWith('//')) return null
    // Reject encoded separators/control characters and dot-segment variants too.
    // Do not decode the returned URL: legitimate query/hash values remain intact.
    let decoded = url.pathname
    for (let depth = 0; depth < 4; depth++) {
      if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return null
      const parsed = new URL(decoded, PLACEHOLDER_ORIGIN)
      if (parsed.origin !== PLACEHOLDER_ORIGIN || parsed.pathname.startsWith('//')) return null
      const value = decodeURIComponent(decoded)
      if (value === decoded) break
      decoded = value
    }
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

export function safeNextPath(next, fallback = '/account') {
  return relativePath(next) || relativePath(fallback) || '/account'
}
