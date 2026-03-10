import { supabaseAdmin } from '@/lib/supabase'
import { sendShippingNotification } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { orderNumber, trackingNumber, carrier, trackingUrl } = await req.json()

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    await supabaseAdmin.from('orders').update({
      status:          'shipped',
      tracking_number: trackingNumber,
      carrier:         carrier,
      tracking_url:    trackingUrl,
      shipped_at:      new Date().toISOString(),
    }).eq('order_number', orderNumber)

    await sendShippingNotification({ order, trackingNumber, carrier, trackingUrl })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Ship email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
