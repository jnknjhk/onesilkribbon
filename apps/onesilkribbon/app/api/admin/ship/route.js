import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { sendShippingNotification } from '@/lib/email'
import { NextResponse } from 'next/server'
import { errorResponse } from '@osr/core/lib/api-error'
import { CAN, statusLabel } from '@osr/core/admin/lib/status'

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '请填写有效的发货信息' }, { status: 400 })
    }
    const { orderNumber, trackingNumber, carrier } = Object.fromEntries(
      ['orderNumber', 'trackingNumber', 'carrier'].map(key => [key, typeof body[key] === 'string' ? body[key].trim() : ''])
    )
    const trackingUrl = typeof body.trackingUrl === 'string' ? body.trackingUrl.trim() : ''
    if (!orderNumber || orderNumber.length > 100 || !trackingNumber || trackingNumber.length > 200 || !carrier || carrier.length > 100 || trackingUrl.length > 2048 || (body.trackingUrl != null && typeof body.trackingUrl !== 'string')) {
      return NextResponse.json({ error: '请填写有效的订单号、快递公司和快递单号' }, { status: 400 })
    }
    if (trackingUrl) {
      let url
      try { url = new URL(trackingUrl) } catch {}
      if (!url || url.protocol !== 'https:' || url.username || url.password || /[\s\\]/.test(trackingUrl)) {
        return NextResponse.json({ error: '追踪链接须为有效的 HTTPS 网址' }, { status: 400 })
      }
    }

    const { data: order, error: readError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle()

    if (readError) return errorResponse(readError, { tag: 'admin-ship-read' })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    // 只有已付款（发货）和已发货（改快递信息）的订单能走这里。以前没付款的订单也能点"发货"
    if (!CAN.ship(order.status)) {
      return NextResponse.json({ error: `订单当前是「${statusLabel(order.status)}」，不能发货` }, { status: 409 })
    }

    const eventTime = new Date().toISOString()

    let update = supabaseAdmin.from('orders').update({
      status:           'shipped',
      tracking_number:  trackingNumber,
      tracking_carrier: carrier,
      tracking_url:     trackingUrl,
      shipped_at:       order.shipped_at || eventTime,
    }).eq('id', order.id).eq('status', order.status)
    // A refund/delivery or another operator's tracking edit must not be overwritten.
    for (const key of ['tracking_number', 'tracking_carrier', 'tracking_url', 'shipped_at']) {
      update = order[key] == null ? update.is(key, null) : update.eq(key, order[key])
    }
    const { data: saved, error: saveError } = await update.select().maybeSingle()
    if (saveError) return errorResponse(saveError, { tag: 'admin-ship-save' })
    if (!saved) return NextResponse.json({ error: '订单状态或快递信息已变化，请刷新后再操作' }, { status: 409 })

    // 落一条发货轨迹。tracking_events 之前只被读、从来没被写过，
    // 导致物流历史完全依赖 AfterShip 实时查询——一旦不再用 AfterShip
    // 或它清了数据，过往轨迹就永久消失了。
    let historySaved = true
    try {
      const { error: historyError } = await supabaseAdmin.from('tracking_events').insert({
        order_id:        order.id,
        tracking_number: trackingNumber,
        carrier,
        status:          'Dispatched',
        message:         '包裹已从工作室发出',
        location:        'One Silk Ribbon',
        event_time:      eventTime,
      })
      if (historyError) throw historyError
    } catch (err) {
      historySaved = false
      errorResponse(err, { tag: 'admin-ship-history' })
    }

    // 订单已保存；历史记录和邮件的失败分别反馈，避免误以为发货没成功而重复操作。
    let emailSent = true
    try {
      await sendShippingNotification({ order: saved, trackingNumber, carrier, trackingUrl })
    } catch {
      emailSent = false
      console.error('[ship] 发货通知邮件发送失败（订单状态已更新）')
    }

    return NextResponse.json({ ok: true, emailSent, historySaved })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-ship-email' })
  }
}
