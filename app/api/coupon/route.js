import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(req) {
  const { code, subtotal } = await req.json()

  if (!code) return Response.json({ error: '请输入优惠码' }, { status: 400 })

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single()

  if (error || !coupon) return Response.json({ error: '优惠码无效' }, { status: 404 })

  // 检查有效期
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return Response.json({ error: '优惠码已过期' }, { status: 400 })
  }

  // 检查使用次数
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return Response.json({ error: '优惠码已达使用上限' }, { status: 400 })
  }

  // 检查最低订单金额
  if (subtotal < coupon.min_order_gbp) {
    return Response.json({ error: `订单满£${coupon.min_order_gbp}才可使用` }, { status: 400 })
  }

  // 计算折扣
  let discountAmount = 0
  if (coupon.discount_type === 'percentage') {
    discountAmount = Math.round(subtotal * coupon.discount_value) / 100
  } else {
    discountAmount = Math.min(coupon.discount_value, subtotal)
  }

  return Response.json({
    valid: true,
    code: coupon.code,
    description: coupon.description,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
  })
}
