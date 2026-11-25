// 支付争议事件的纯映射函数（无 I/O，便于单元测试）。
const RESOLVED_STATUSES = new Set([
  'won', 'lost', 'warning_closed', 'resolved', 'cancelled',
  // Stripe: dispute closed after a refund / closed preventively.
  'charge_refunded', 'prevented',
])

export function isResolvedDispute(status) {
  return RESOLVED_STATUSES.has(String(status || '').toLowerCase())
}

export function mapStripeDispute(dispute) {
  const intent = typeof dispute?.payment_intent === 'string' ? dispute.payment_intent : dispute?.payment_intent?.id
  const dueBy = Number(dispute?.evidence_details?.due_by)
  const amount = Number(dispute?.amount)
  return {
    provider: 'stripe',
    disputeId: dispute?.id || null,
    status: dispute?.status || 'needs_response',
    orderNumber: dispute?.metadata?.orderNumber || null,
    paymentId: intent || null,
    reason: dispute?.reason || null,
    amountPence: Number.isSafeInteger(amount) && amount > 0 ? amount : null,
    currency: String(dispute?.currency || 'gbp').toUpperCase(),
    evidenceDueBy: Number.isFinite(dueBy) && dueBy > 0 ? new Date(dueBy * 1000).toISOString() : null,
  }
}

export function mapPayPalDispute(resource, eventId) {
  const transaction = Array.isArray(resource?.disputed_transactions) ? resource.disputed_transactions[0] : null
  const amount = resource?.dispute_amount || transaction?.seller_transaction_amount || transaction?.buyer_transaction_amount || null
  const value = Number(amount?.value)
  return {
    provider: 'paypal',
    disputeId: resource?.dispute_id || resource?.id || eventId || null,
    status: String(resource?.status || resource?.dispute_state || 'OPEN'),
    orderNumber: null,
    paymentId: transaction?.seller_transaction_id || null,
    reason: resource?.reason || null,
    amountPence: Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null,
    currency: String(amount?.currency_code || '').toUpperCase() || null,
    evidenceDueBy: resource?.seller_response_due_date || resource?.evidence_due_by_date || null,
  }
}
