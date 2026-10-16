import { createHmac, timingSafeEqual, createHash } from 'node:crypto'

function signature(payload) {
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!key) throw new Error('Payment proof key unavailable')
  return createHmac('sha256', key).update('order-confirmation:' + payload).digest('hex')
}

export function checkoutReference(sessionId) {
  return createHash('sha256').update(sessionId).digest('hex')
}

export function confirmationCookieName(orderNumber) {
  return 'osr-confirm-' + createHash('sha256').update(String(orderNumber)).digest('hex').slice(0,24)
}

export function readConfirmationCookie(req, orderNumber) {
  const name = confirmationCookieName(orderNumber) + '='
  const value = (req.headers.get('cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name))
  try { return value ? decodeURIComponent(value.slice(name.length)) : '' } catch { return '' }
}

export function createPaymentProof(orderNumber, reference) {
  const payload = Buffer.from(JSON.stringify({ orderNumber, expires: Date.now() + 86400000,
    ...(/^[a-f0-9]{64}$/.test(reference || '') ? { checkoutReference: reference } : {}),
  })).toString('base64url')
  return payload + '.' + signature(payload)
}

export function paymentProofDetails(proof, orderNumber) {
  try {
    if (typeof proof !== 'string' || proof.length > 2048) return null
    const [payload, mac, extra] = proof.split('.')
    if (extra || !/^[a-f0-9]{64}$/.test(mac || '')) return null
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(payload), 'hex'))) return null
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return value.orderNumber === orderNumber && Number.isFinite(value.expires) && value.expires > Date.now() ? value : null
  } catch { return null }
}

export function verifyPaymentProof(proof, orderNumber) {
  return paymentProofDetails(proof, orderNumber) !== null
}
