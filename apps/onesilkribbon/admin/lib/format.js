// 后台通用的金额 / 日期格式化
export function money(n) {
  const v = Number(n)
  return `£${(Number.isFinite(v) ? v : 0).toFixed(2)}`
}

export function date(s) {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('zh-CN')
}

export function dateTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// "今天 / 昨天 / 3 天前"——列表里看"这单等了多久"比看具体日期快
export function ago(s) {
  if (!s) return '—'
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  return date(s)
}

export function daysSince(s) {
  if (!s) return 0
  return Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
}

export function slugify(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
