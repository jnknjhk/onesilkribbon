// 前台账户页共用的订单状态。后台中文标签在 admin/lib/status.js，
// 但两边必须使用同一组状态 key；这里不再保留不存在的 processing。
export const ORDER_STATUS = {
  pending:   { label: 'Pending',   color: { bg: '#FEF9EE', text: '#B45309' } },
  paid:      { label: 'Paid',      color: { bg: '#F0FDF4', text: '#15803D' } },
  shipped:   { label: 'Shipped',   color: { bg: '#EFF6FF', text: '#1D4ED8' } },
  delivered: { label: 'Delivered', color: { bg: '#F0FDF4', text: '#15803D' } },
  cancelled: { label: 'Cancelled', color: { bg: '#FEF2F2', text: '#B91C1C' } },
  refunded:  { label: 'Refunded',  color: { bg: '#F5F3FF', text: '#6D28D9' } },
}

export const ACTIVE_ORDER_STATUSES = ['paid', 'shipped']
export const TRACKABLE_ORDER_STATUSES = ['paid', 'shipped', 'delivered']

export function orderStatusLabel(status) {
  return ORDER_STATUS[status]?.label || status || '—'
}
