import { supabaseAdmin } from '@osr/core/lib/supabase'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const orderNumber = searchParams.get('order')

  if (!orderNumber) {
    return Response.json({ error: 'Order number required' }, { status: 400 })
  }

  try {
    // Fetch order from DB
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()

    if (error || !order) {
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
          location: 'One Silk Ribbon Studio',
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
      location: 'One Silk Ribbon',
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
