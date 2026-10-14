import { createHmac, timingSafeEqual } from 'node:crypto'

function signature(payload) {
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!key) throw new Error('Payment proof key unavailable')
  return createHmac('sha256', key).update('order-confirmation:' + payload).digest('hex')
}

export function createPaymentProof(orderNumber) {
  const payload = Buffer.from(JSON.stringify({ orderNumber, expires: Date.now() + 86400000 })).toString('base64url')
  return payload + '.' + signature(payload)
}

export function verifyPaymentProof(proof, orderNumber) {
  try {
    if (typeof proof !== 'string' || proof.length > 2048) return false
    const [payload, mac, extra] = proof.split('.')
    if (extra || !/^[a-f0-9]{64}$/.test(mac || '')) return false
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(payload), 'hex'))) return false
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return value.orderNumber === orderNumber && value.expires > Date.now()
  } catch { return false }
}
