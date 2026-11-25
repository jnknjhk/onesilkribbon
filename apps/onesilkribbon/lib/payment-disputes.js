import { supabaseAdmin } from '@osr/core/lib/supabase'
import { escapeHtml } from '@osr/core/lib/escape-html'
import { OWNER_EMAIL, sendEmail } from '@/lib/email'
import { isResolvedDispute } from '@/lib/dispute-shapes'

export { mapPayPalDispute, mapStripeDispute } from '@/lib/dispute-shapes'

export async function recordPaymentDispute(input) {
  if (!input?.disputeId) throw new Error('Dispute id is required')
  if (!['stripe', 'paypal'].includes(input.provider)) throw new Error('Unknown dispute provider')

  const { data: existing, error } = await supabaseAdmin.from('payment_disputes')
    .select('id,status,order_number,payment_id,reason,amount_pence,currency,evidence_due_by,resolved_at')
    .eq('provider', input.provider).eq('dispute_id', input.disputeId)
    .maybeSingle()
  if (error) throw error

  // 支付平台不保证 webhook 顺序：已结案的争议不能被迟到/重放的“进行中”事件改回去。
  if (existing?.resolved_at && !isResolvedDispute(input.status)) {
    return { dispute: existing, created: false, previousStatus: existing.status, ignored: true }
  }

  const row = {
    provider: input.provider,
    dispute_id: input.disputeId,
    order_number: input.orderNumber || existing?.order_number || null,
    // 迟到的事件可能少字段；已有的金额/支付单号/原因不要被 null 覆盖。
    payment_id: input.paymentId || existing?.payment_id || null,
    status: input.status,
    reason: input.reason || existing?.reason || null,
    amount_pence: input.amountPence ?? existing?.amount_pence ?? null,
    currency: input.currency || existing?.currency || null,
    evidence_due_by: input.evidenceDueBy || existing?.evidence_due_by || null,
    updated_at: new Date().toISOString(),
    // 结案时间只写一次；重复的结案事件不会刷新它。
    resolved_at: isResolvedDispute(input.status)
      ? (existing?.resolved_at || new Date().toISOString())
      : null,
  }

  const { data, error: upsertError } = await supabaseAdmin.from('payment_disputes')
    .upsert(row, { onConflict: 'provider,dispute_id' })
    .select().single()
  if (upsertError) throw upsertError

  return { dispute: data, created: !existing, previousStatus: existing?.status || null }
}

export async function sendDisputeAlert(dispute) {
  const amount = dispute.amountPence != null
    ? `£${(dispute.amountPence / 100).toFixed(2)} ${dispute.currency || ''}`.trim()
    : 'Amount not provided'
  const due = dispute.evidenceDueBy
    ? new Date(dispute.evidenceDueBy).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not provided'

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#F7F3EE;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;">
    <h1 style="font-size:18px;letter-spacing:.15em;text-transform:uppercase;color:#1C1714;">Payment dispute</h1>
    <p style="font-size:14px;color:#4a4039;line-height:1.8;">
      ${escapeHtml(dispute.provider === 'stripe' ? 'Stripe' : 'PayPal')} reported a dispute on
      ${dispute.orderNumber ? `order <strong>${escapeHtml(dispute.orderNumber)}</strong>` : 'an order'}.
    </p>
    <table style="font-size:13px;color:#4a4039;line-height:1.9;">
      <tr><td style="padding-right:16px;color:#9A8878;">Status</td><td>${escapeHtml(dispute.status)}</td></tr>
      <tr><td style="padding-right:16px;color:#9A8878;">Amount</td><td>${escapeHtml(amount)}</td></tr>
      <tr><td style="padding-right:16px;color:#9A8878;">Reason</td><td>${escapeHtml(dispute.reason || 'Not provided')}</td></tr>
      <tr><td style="padding-right:16px;color:#9A8878;">Evidence due</td><td>${escapeHtml(due)}</td></tr>
      <tr><td style="padding-right:16px;color:#9A8878;">Dispute ID</td><td>${escapeHtml(dispute.disputeId)}</td></tr>
    </table>
    <p style="font-size:13px;color:#4a4039;line-height:1.8;margin-top:24px;">
      Respond in the ${escapeHtml(dispute.provider === 'stripe' ? 'Stripe' : 'PayPal')} dashboard.
      <a href="https://onesilkribbon.com/admin/settings?tab=payment-recovery" style="color:#B89B6A;">Open payment recovery</a>
    </p>
  </div>
</body></html>`

  await sendEmail({
    to: OWNER_EMAIL,
    subject: `Payment dispute (${dispute.status})${dispute.orderNumber ? ' — ' + dispute.orderNumber : ''}`,
    html,
    kind: 'dispute_alert',
    orderNumber: dispute.orderNumber || null,
    deliveryKey: `dispute/${dispute.provider}/${dispute.disputeId}/${dispute.status}`,
  })
}

// 记录争议并在新建/状态变化时提醒店主。提醒失败不能影响 webhook 的 2xx：
// 争议已经落库，后台能看到；让支付平台无限重试反而会放大问题。
export async function recordAndNotifyDispute(input) {
  const result = await recordPaymentDispute(input)
  const changed = !result.ignored && (result.created || (result.previousStatus && result.previousStatus !== input.status))
  if (changed) {
    try {
      await sendDisputeAlert({ ...input, orderNumber: input.orderNumber || result.dispute?.order_number || null })
    } catch (err) {
      console.error('[payment-dispute] owner alert failed', err?.message)
    }
  }
  return result
}
