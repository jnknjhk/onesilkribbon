const BROWSER_KEY = 'osr-checkout-browser'
export const CHECKOUT_DRAFT_KEY = 'osr-checkout-return-details'

export async function checkoutRequestKey(material) {
  const getKey = async () => {
    let browserKey = localStorage.getItem(BROWSER_KEY)
    if (!browserKey) {
      browserKey = crypto.randomUUID()
      localStorage.setItem(BROWSER_KEY, browserKey)
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(browserKey + material))
    const storageKey = 'osr-checkout-request-' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
    const requestKey = localStorage.getItem(storageKey) || crypto.randomUUID()
    localStorage.setItem(storageKey, requestKey)
    return { requestKey, storageKey }
  }
  return navigator.locks ? navigator.locks.request(BROWSER_KEY, getKey) : getKey()
}

export function saveCheckoutDraft(form) {
  sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ form, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }))
}

export function takeCheckoutDraft() {
  const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
  sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
  const draft = JSON.parse(raw || 'null')
  return draft?.expiresAt > Date.now() ? draft.form : null
}
