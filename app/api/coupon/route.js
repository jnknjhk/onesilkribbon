import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function POST(req) {
  const { code, subtotal } = await req.json()

  if (!code) return Response.json({ error: 'Please enter a promo code' }, { status: 400 })

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single()

  if (error || !coupon) return Response.json({ error: 'Invalid promo code' }, { status: 404 })

  // 检查有效期
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return Response.json({ error: 'This promo code has expired' }, { status: 400 })
  }

  // 检查使用次数
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return Response.json({ error: 'This promo code has reached its usage limit' }, { status: 400 })
  }

  // 检查最低订单金额
  if (subtotal < coupon.min_order_gbp) {
    return Response.json({ error: `Minimum order value of £${coupon.min_order_gbp} required` }, { status: 400 })
  }

  // 计算折扣
  let discountAmount = 0
  if (coupon.discount_type === 'percentage') {
    // discount_value 是百分比数字，如 10 表示打九折（折扣10%）
    discountAmount = parseFloat((subtotal * coupon.discount_value / 100).toFixed(2))
  } else {
    discountAmount = parseFloat(Math.min(coupon.discount_value, subtotal).toFixed(2))
  }
  // 确保折扣后金额不低于 Stripe 最低收款额 £0.30
  discountAmount = parseFloat(Math.min(discountAmount, subtotal - 0.30).toFixed(2))

  return Response.json({
    valid: true,
    code: coupon.code,
    description: coupon.description,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
  })
}
