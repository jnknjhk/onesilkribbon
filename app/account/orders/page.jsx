'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AccountLayout from '@/components/AccountLayout'
import { useAuth } from '@/lib/auth'

const STATUS_LABEL = {
  pending: 'Pending', paid: 'Paid', processing: 'Processing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
}
const STATUS_COLOR = {
  pending:    { bg: '#FEF9EE', text: '#B45309' },
  paid:       { bg: '#F0FDF4', text: '#15803D' },
  processing: { bg: '#EFF6FF', text: '#1D4ED8' },
  shipped:    { bg: '#EFF6FF', text: '#1D4ED8' },
  delivered:  { bg: '#F0FDF4', text: '#15803D' },
  cancelled:  { bg: '#FEF2F2', text: '#B91C1C' },
  refunded:   { bg: '#F5F3FF', text: '#6D28D9' },
}

function StatusBadge({ status }) {
  const s = STATUS_COLOR[status] || { bg: 'var(--mist)', text: 'var(--taupe)' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', background: s.bg, color: s.text, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', borderRadius: 2 }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

const FILTERS = ['all', 'paid', 'shipped', 'delivered', 'cancelled']
const FILTER_LABEL = { all: 'All', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    fetch('/api/user/orders', {
      headers: { Authorization: `Bearer ${user.accessToken || ''}` },
    })
      .then(r => r.json())
      .then(data => { setOrders(data.orders || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const fmtDate = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtGBP = n => `£${Number(n).toFixed(2)}`

  return (
    <AccountLayout>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Account</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)' }}>My Orders</h1>
      </div>

      {/* 过滤标签 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', border: '1px solid',
            borderColor: filter === f ? 'var(--gold)' : 'var(--sand)',
            background: filter === f ? 'var(--gold)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--taupe)',
            fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'all 0.2s',
          }}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      <div style={{ background: '#fff', border: '1px solid var(--sand)' }}>
        {loading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 22, height: 22, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="1" style={{ margin: '0 auto 16px' }}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <p style={{ fontSize: 13, color: 'var(--taupe)', marginBottom: 20 }}>
              {filter === 'all' ? 'No orders yet.' : `No ${FILTER_LABEL[filter].toLowerCase()} orders.`}
            </p>
            {filter === 'all' && (
              <Link href="/collections" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--gold)', color: '#fff', fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Start Shopping
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* 表头 — 仅桌面端 */}
            <div className="orders-header" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px 28px', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--mist)' }}>
              {['Order', 'Date', 'Status', 'Total', ''].map(h => (
                <p key={h} style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--taupe)' }}>{h}</p>
              ))}
            </div>

            {filtered.map((order, i) => (
              <Link key={order.id} href={`/account/orders/${order.id}`} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px 28px',
                gap: 12, alignItems: 'center',
                padding: '16px 24px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--mist)' : 'none',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
                className="order-row"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--mist)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400, marginBottom: 3 }}>{order.order_number}</p>
                  <p style={{ fontSize: 11, color: 'var(--taupe)' }}>{order.shipping_name}</p>
                </div>
                <p style={{ fontSize: 12, color: 'var(--deep)' }}>{fmtDate(order.created_at)}</p>
                <div><StatusBadge status={order.status} /></div>
                <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400 }}>{fmtGBP(order.total_gbp)}</p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="1.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 600px) {
          .orders-header { display: none !important; }
          .order-row { grid-template-columns: 1fr auto !important; }
          .order-row > *:nth-child(2),
          .order-row > *:nth-child(3) { display: none; }
        }
      ` }} />
    </AccountLayout>
  )
}
