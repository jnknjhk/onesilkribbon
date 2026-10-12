import { supabaseAdmin } from '@osr/core/lib/supabase'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const orderNumber = searchParams.get('order')
  const email = searchParams.get('email')

  // 光凭订单号就能查到收件人、城市和物流单号——而订单号是可猜的：
  // PayPal 单是 OSR-YYMMDD-4位随机数，Stripe 单是 OSR-年份-4位-3位，
  // 猜中一个只需要几千次请求。所以必须同时验证下单邮箱才返回任何信息。
  if (!orderNumber || !email) {
    return Response.json({ error: 'Order number and email are required' }, { status: 400 })
  }

  try {
    // Fetch order from DB
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle()

    // 邮箱不符和订单不存在返回完全相同的响应——否则这个接口就变成了
    // "订单号是否存在" 的探测器，仍然能被拿来枚举
    const emailMatches = order &&
      (order.customer_email || '').trim().toLowerCase() === email.trim().toLowerCase()

    if (error || !order || !emailMatches) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    // Mask sensitive address info for privacy
    const maskedName = order.shipping_name
      ? order.shipping_name.split(' ').map((w, i) => i === 0 ? w : w[0] + '***').join(' ')
      : null

    // If no tracking number yet, return order status
    if (!order.tracking_number) {
      return Response.json({
        orderNumber: order.order_number,
        status: order.status === 'paid' ? 'Processing' : order.status,
        statusStep: order.status === 'paid' ? 1 : 0,
        carrier: null,
        trackingNumber: null,
        estimatedDelivery: 'To be confirmed',
        shippingName: maskedName,
        shippingCity: order.shipping_city,
        shippingCountry: order.shipping_country,
        events: [{
          date: new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          location: 'One Glass Object Studio',
          message: 'Order received and being prepared',
        }],
      })
    }

    // Fetch from AfterShip (if API key is set)
    let tracking = null
    if (process.env.AFTERSHIP_API_KEY) {
      try {
        const aftershipRes = await fetch(
          `https://api.aftership.com/v4/trackings/${order.tracking_carrier}/${order.tracking_number}`,
          { headers: { 'aftership-api-key': process.env.AFTERSHIP_API_KEY } }
        )
        const aftershipData = await aftershipRes.json()
        tracking = aftershipData.data?.tracking
      } catch (e) { console.error('AfterShip error:', e) }
    }

    // Map AfterShip status to our step index
    const statusMap = {
      'Pending': 0, 'InfoReceived': 1, 'InTransit': 3,
      'OutForDelivery': 3, 'AttemptFail': 3, 'Delivered': 4,
      'Exception': 3, 'Expired': 1,
    }

    const events = tracking ? (tracking.checkpoints || []).map(cp => ({
      date: new Date(cp.checkpoint_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      location: cp.location || cp.country_name || '',
      message: cp.message,
    })).reverse() : [{
      date: new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      location: 'One Glass Object',
      message: 'Order dispatched',
    }]

    return Response.json({
      orderNumber: order.order_number,
      status: tracking?.tag || 'InTransit',
      statusStep: statusMap[tracking?.tag] ?? 2,
      carrier: order.tracking_carrier,
      trackingNumber: order.tracking_number,
      shippingName: maskedName,
      shippingCity: order.shipping_city,
      shippingCountry: order.shipping_country,
      estimatedDelivery: tracking?.expected_delivery
        ? new Date(tracking.expected_delivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '7–15 working days',
      events,
    })
  } catch (err) {
    console.error('Tracking error:', err)
    return Response.json({ error: 'Tracking service unavailable' }, { status: 500 })
  }
}
