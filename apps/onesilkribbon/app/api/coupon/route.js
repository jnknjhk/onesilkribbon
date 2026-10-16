import { computeAuthoritativeOrder } from '@/lib/order-pricing'

export async function POST(req) {
  const invalid = () => Response.json({ error: 'Invalid promo code' }, { status: 400 })
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        typeof body.code !== 'string' || !body.code.trim() || body.code.length > 100 ||
        !Array.isArray(body.items)) return invalid()
    const result = await computeAuthoritativeOrder({ items: body.items, couponCode: body.code })
    if (!result.ok) return invalid()
    return Response.json({ valid: true, code: result.totals.couponCode,
      discountAmount: Number(result.totals.discount) })
  } catch {
    return invalid()
  }
}
