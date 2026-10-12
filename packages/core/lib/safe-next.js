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

export function safeNextPath(next, fallback = '/account') {
  if (typeof next !== 'string' || !next.startsWith('/')) return fallback
  try {
    const url = new URL(next, PLACEHOLDER_ORIGIN)
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
