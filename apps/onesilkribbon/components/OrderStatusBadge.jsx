'use client'
import { ORDER_STATUS } from '@/lib/order-status'

export default function OrderStatusBadge({ status, large = false }) {
  const color = ORDER_STATUS[status]?.color || { bg: 'var(--mist)', text: 'var(--taupe)' }
  return (
    <span style={{
      display: 'inline-block',
      padding: large ? '5px 14px' : '3px 10px',
      background: color.bg,
      color: color.text,
      fontSize: large ? 11 : 10,
      letterSpacing: large ? '.1em' : '.08em',
      textTransform: 'uppercase',
      borderRadius: 2,
    }}>
      {ORDER_STATUS[status]?.label || status}
    </span>
  )
}
