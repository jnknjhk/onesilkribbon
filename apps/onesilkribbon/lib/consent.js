// Cookie 同意状态的单一事实来源。CookieBanner（写入）和 Analytics（读取）
// 必须对 key 和事件名达成一致，所以放在这里共享，避免两边各写一份字符串写错。

export const CONSENT_KEY = 'osr_cookie_consent'

// 同一标签页内 localStorage 的变化不会触发原生 storage 事件
//（那个只在"其他"标签页触发），所以自己派发一个事件通知本页。
export const CONSENT_EVENT = 'osr-consent-change'

// 读取同意状态。localStorage 在隐私模式/禁用 cookie 时会直接抛异常，
// 读不到一律当作"未同意"（fail closed）。
export function hasConsented() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted'
  } catch {
    return false
  }
}

// 记录选择并立即通知本页监听者
export function setConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // 存不下就算了，横幅照常关闭，只是下次访问会再问一遍
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}
