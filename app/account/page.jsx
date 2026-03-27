'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AccountLayout from '@/components/AccountLayout'
import { useAuth } from '@/lib/auth'

const STATUS_LABEL = {
  pending:    'Pending',
  paid:       'Paid',
  processing: 'Processing',
  shipped:    'Shipped',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
  refunded:   'Refunded',
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
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      background: s.bg, color: s.text,
      fontSize: 10, letterSpacing: '.08em',
      textTransform: 'uppercase', borderRadius: 2,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export default function AccountPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.accessToken) return
    fetch('/api/user/orders', {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then(r => r.json())
      .then(data => { setOrders(data.orders || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  const recentOrders = orders.slice(0, 3)
  const fmtDate = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtGBP = n => `£${Number(n).toFixed(2)}`

  return (
    <AccountLayout>
      {/* 欢迎语 */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          My Account
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)' }}>
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
      </div>

      {/* 快捷卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }} className="account-quick-grid">
        {[
          { href: '/account/orders',    label: 'Total Orders',   value: orders.length,   sub: 'all time' },
          { href: '/account/orders',    label: 'Active Orders',  value: orders.filter(o => ['paid','processing','shipped'].includes(o.status)).length, sub: 'in progress' },
          { href: '/account/addresses', label: 'Saved Addresses', value: '—', sub: 'manage' },
        ].map(card => (
          <Link key={card.href} href={card.href} style={{
            display: 'block', background: '#fff',
            border: '1px solid var(--sand)', padding: '20px 20px 18px',
            textDecoration: 'none',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--sand)'}
          >
            <p style={{ fontSize: 9, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 10 }}>{card.label}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginBottom: 6 }}>{card.value}</p>
            <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.06em' }}>{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* 最近订单 */}
      <div style={{ background: '#fff', border: '1px solid var(--sand)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--mist)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--ink)' }}>Recent Orders</p>
          {orders.length > 3 && (
            <Link href="/account/orders" style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '.06em', textDecoration: 'none' }}>
              View all →
            </Link>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : recentOrders.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--taupe)', marginBottom: 16 }}>No orders yet.</p>
            <Link href="/collections" style={{
              display: 'inline-block', padding: '10px 24px',
              background: 'var(--gold)', color: '#fff',
              fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
              textDecoration: 'none', transition: 'background 0.2s',
            }}>
              Start Shopping
            </Link>
          </div>
        ) : (
          <div>
            {recentOrders.map((order, i) => (
              <Link key={order.id} href={`/account/orders/${order.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 24px',
                borderBottom: i < recentOrders.length - 1 ? '1px solid var(--mist)' : 'none',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--mist)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3, fontWeight: 400 }}>{order.order_number}</p>
                  <p style={{ fontSize: 11, color: 'var(--taupe)' }}>{fmtDate(order.created_at)}</p>
                </div>
                <StatusBadge status={order.status} />
                <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400, minWidth: 60, textAlign: 'right' }}>
                  {fmtGBP(order.total_gbp)}
                </p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="1.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 600px) {
          .account-quick-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </AccountLayout>
  )
}
