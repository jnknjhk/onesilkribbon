import Stripe from 'stripe'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { errorResponse } from '@osr/core/lib/api-error'

export async function POST(req) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { orderId, manual = false, restock = false, reason } = await req.json()
    if (typeof orderId !== 'string' || typeof manual !== 'boolean' || typeof restock !== 'boolean') {
      return Response.json({ error: 'Invalid refund options' }, { status: 400 })
    }
    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single()
    if (error) throw error
    if (!manual && order.payment_method !== 'stripe') return Response.json({
      success: false, needsManual: true, error: '请先在支付平台手动退款，再选择“我已手动退款”。',
    })
    const { data: request, error: beginError } = await supabaseAdmin.rpc('begin_order_refund', {
      p_order_id: orderId, p_manual: manual === true, p_restock: restock === true,
      p_reason: String(reason || (manual ? '已在支付平台手动退款' : '')).slice(0, 2000),
    })
    if (beginError) throw beginError
    if (!manual && !request.completed_at) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      let intent = order.payment_intent_id
      if (intent?.startsWith('cs_')) intent = (await stripe.checkout.sessions.retrieve(intent)).payment_intent
      if (typeof intent !== 'string' || !intent.startsWith('pi_')) throw new Error('Missing Stripe payment identity')
      let refund
      if (request.provider_id) refund = await stripe.refunds.retrieve(request.provider_id)
      else {
        // Also recover a previous response lost after the provider completed the refund.
        const previous = await stripe.refunds.list({ payment_intent: intent, limit: 100 })
        refund = previous.data.find(r => r.metadata?.osr_order_id === orderId)
        if (!refund) refund = await stripe.refunds.create({
          payment_intent: intent, reason: 'requested_by_customer', metadata: { osr_order_id: orderId },
        }, { idempotencyKey: `order-refund/${orderId}` })
      }
      if (refund.payment_intent !== intent) throw new Error('Refund payment mismatch')
      const { error: saveError } = await supabaseAdmin.from('refund_requests')
        .update({ provider_id: refund.id, provider_status: refund.status }).eq('order_id', orderId)
      if (saveError) throw saveError
      if (refund.status !== 'succeeded') return Response.json({
        success: false, error: '支付平台尚未确认退款成功，库存未回补。请稍后用相同选项重试核对。',
      }, { status: 409 })
    }
    const { data: result, error: finishError } = await supabaseAdmin.rpc('finish_order_refund', { p_order_id: orderId })
    if (finishError) throw finishError
    return Response.json(result)
  } catch (err) {
    return errorResponse(err, { status: 409, tag: 'admin-refund',
      message: '退款尚未处理完成，记录已保留。请使用相同退款选项重试；不要在支付平台重复退款。' })
  }
}
