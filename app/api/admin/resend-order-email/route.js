import { verifyAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOrderConfirmation } from '@/lib/email'

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { orderId } = await req.json()

    const { data: order } = await supabaseAdmin
      .from('orders').select('*').eq('id', orderId).single()
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

    const { data: orderItems } = await supabaseAdmin
      .from('order_items').select('*').eq('order_id', orderId)

    const items = (orderItems || []).map(i => ({
      name:    i.product_name,
      skuDesc: i.sku_description || '',
      price:   parseFloat(i.unit_price_gbp),
      qty:     i.quantity,
    }))

    const form = {
      email:     order.customer_email,
      firstName: (order.shipping_name || '').split(' ')[0],
      lastName:  (order.shipping_name || '').split(' ').slice(1).join(' '),
      line1:     order.shipping_line1,
      line2:     order.shipping_line2 || '',
      city:      order.shipping_city,
      postcode:  order.shipping_postcode,
      country:   order.shipping_country,
      phone:     order.phone || '',
    }

    const totals = {
      subtotal:    order.subtotal_gbp,
      shipping:    order.shipping_gbp,
      total:       order.total_gbp,
      freeShipping: parseFloat(order.shipping_gbp) === 0,
    }

    await sendOrderConfirmation({ order, items, form, totals })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Resend email error:', err)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
