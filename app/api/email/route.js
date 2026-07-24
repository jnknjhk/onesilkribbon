import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { sendShippingNotification } from '@/lib/email'
import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-error'

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { orderNumber, trackingNumber, carrier, trackingUrl } = await req.json()

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    await supabaseAdmin.from('orders').update({
      status:           'shipped',
      tracking_number:  trackingNumber,
      tracking_carrier: carrier,
      tracking_url:     trackingUrl,
      shipped_at:       new Date().toISOString(),
    }).eq('order_number', orderNumber)

    await sendShippingNotification({ order, trackingNumber, carrier, trackingUrl })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-ship-email' })
  }
}
