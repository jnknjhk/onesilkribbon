import crypto from 'node:crypto'

// 退订链接用 HMAC 签名，不存额外 token，也不暴露数据库。
// 密钥优先用 UNSUBSCRIBE_SECRET，未配置时回退到服务端密钥；两者都只在服务端可见。
function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_KEY ||
    (process.env.NODE_ENV === 'production' ? '' : 'onesilkribbon-dev-unsubscribe')
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function unsubscribeToken(email) {
  const key = secret()
  // 生产环境两个密钥都没配时宁可不发链接，也不要用公开常量签发可伪造的 token。
  if (!key) return ''
  return crypto.createHmac('sha256', key).update(normalizeEmail(email)).digest('hex').slice(0, 40)
}

export function verifyUnsubscribeToken(email, token) {
  // 先校验格式：非十六进制/多字节字符会让 timingSafeEqual 因字节长度不同而抛错。
  if (typeof token !== 'string' || !/^[a-f0-9]{40}$/i.test(token)) return false
  const expected = unsubscribeToken(email)
  if (!/^[a-f0-9]{40}$/.test(expected)) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token.toLowerCase(), 'hex'))
}

function siteBase(siteUrl) {
  return (siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://onesilkribbon.com').replace(/\/+$/, '')
}

// 人手点击的页面：先展示确认按钮，避免邮件扫描器自动退订。
export function unsubscribePageUrl(email, siteUrl) {
  return `${siteBase(siteUrl)}/unsubscribe?email=${encodeURIComponent(normalizeEmail(email))}&token=${unsubscribeToken(email)}`
}

// RFC 8058 一键退订：邮箱服务商直接 POST 到这个地址。
export function unsubscribeApiUrl(email, siteUrl) {
  return `${siteBase(siteUrl)}/api/unsubscribe?email=${encodeURIComponent(normalizeEmail(email))}&token=${unsubscribeToken(email)}`
}

export function unsubscribeHeaders(email, siteUrl) {
  return {
    'List-Unsubscribe': `<${unsubscribeApiUrl(email, siteUrl)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
