import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { sendShippingNotification } from '@/lib/email'
import { NextResponse } from 'next/server'
import { errorResponse } from '@osr/core/lib/api-error'

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

    const shippedAt = new Date().toISOString()

    await supabaseAdmin.from('orders').update({
      status:           'shipped',
      tracking_number:  trackingNumber,
      tracking_carrier: carrier,
      tracking_url:     trackingUrl,
      shipped_at:       shippedAt,
    }).eq('order_number', orderNumber)

    // 落一条发货轨迹。tracking_events 之前只被读、从来没被写过，
    // 导致物流历史完全依赖 AfterShip 实时查询——一旦不再用 AfterShip
    // 或它清了数据，过往轨迹就永久消失了。
    await supabaseAdmin.from('tracking_events').insert({
      order_id:        order.id,
      tracking_number: trackingNumber,
      carrier,
      status:          'Dispatched',
      message:         '包裹已从工作室发出',
      location:        'One Silk Ribbon',
      event_time:      shippedAt,
    })

    // 邮件发送失败不应该让整个发货操作显示为失败——订单状态和轨迹都已经
    // 正确写入了。之前这里没有 catch，邮件一挂，后台会提示"发送失败"，
    // 而实际上订单已经标记为已发货，容易让人误以为没成功而重复操作。
    let emailSent = true
    try {
      await sendShippingNotification({ order, trackingNumber, carrier, trackingUrl })
    } catch (e) {
      emailSent = false
      console.error('[ship] 发货通知邮件发送失败（订单状态已更新）:', e.message)
    }

    return NextResponse.json({ ok: true, emailSent })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-ship-email' })
  }
}
