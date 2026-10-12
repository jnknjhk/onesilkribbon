// 把用户填的文字放进 HTML（主要是邮件模板）之前必须先转义，
// 否则对方填一段 <a href=...> 就能让邮件里出现他想要的链接和排版。
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ENTITIES[c])
}
