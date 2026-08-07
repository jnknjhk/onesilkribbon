// 全站两个订阅入口（首页 Newsletter 区块 + 欢迎弹窗）共用同一套提交逻辑，
// 保证校验标准、请求格式一致，各自只负责自己的 UI 展示。
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email) {
  return EMAIL_RE.test((email || '').trim())
}

// source 标识订阅来自哪个入口，便于后台区分统计
export async function subscribeEmail(email, source) {
  const trimmed = (email || '').trim()
  if (!isValidEmail(trimmed)) {
    return { ok: false, error: 'Please enter a valid email address' }
  }
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed, source }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || 'Something went wrong' }
    return { ok: true, already: !!data.already }
  } catch {
    return { ok: false, error: 'Something went wrong, please try again' }
  }
}
