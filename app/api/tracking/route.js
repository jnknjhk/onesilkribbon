import { supabaseAdmin } from '@/lib/supabase'

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

    // If no tracking number yet, return order status
    if (!order.tracking_number) {
      return Response.json({
        orderNumber: order.order_number,
        status: order.status === 'paid' ? 'Processing' : order.status,
        statusStep: order.status === 'paid' ? 1 : 0,
        carrier: null,
        trackingNumber: null,
        estimatedDelivery: 'To be confirmed',
        events: [{
          date: new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          location: 'One Silk Ribbon Studio',
          message: 'Order received and being prepared',
        }],
      })
    }

    // Fetch from AfterShip
    const aftershipRes = await fetch(
      `https://api.aftership.com/v4/trackings/${order.tracking_carrier}/${order.tracking_number}`,
      { headers: { 'aftership-api-key': process.env.AFTERSHIP_API_KEY } }
    )
    const aftershipData = await aftershipRes.json()
    const tracking = aftershipData.data?.tracking

    // Map AfterShip status to our step index
    const statusMap = {
      'Pending': 0, 'InfoReceived': 1, 'InTransit': 3,
      'OutForDelivery': 3, 'AttemptFail': 3, 'Delivered': 4,
      'Exception': 3, 'Expired': 1,
    }

    const events = (tracking?.checkpoints || []).map(cp => ({
      date: new Date(cp.checkpoint_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      location: cp.location || cp.country_name || '',
      message: cp.message,
    })).reverse()

    return Response.json({
      orderNumber: order.order_number,
      status: tracking?.tag || 'InTransit',
      statusStep: statusMap[tracking?.tag] ?? 2,
      carrier: order.tracking_carrier,
      trackingNumber: order.tracking_number,
      estimatedDelivery: tracking?.expected_delivery
        ? new Date(tracking.expected_delivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '3–5 working days',
      events,
    })
  } catch (err) {
    console.error('Tracking error:', err)
    return Response.json({ error: 'Tracking service unavailable' }, { status: 500 })
  }
}
