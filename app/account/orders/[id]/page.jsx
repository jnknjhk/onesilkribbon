'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

// 订单状态进度条步骤（与系统实际使用的状态保持一致：pending/paid/shipped）
const STEPS = ['pending', 'paid', 'shipped']
const STEP_LABEL = { pending: 'Order Placed', paid: 'Payment Confirmed', shipped: 'Shipped' }

function OrderProgress({ status }) {
  const currentIdx = STEPS.indexOf(status)
  if (currentIdx === -1) return null
  return (
    <div style={{ padding: '24px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        {/* 连接线 */}
        <div style={{ position: 'absolute', top: 10, left: '12.5%', right: '12.5%', height: 1, background: 'var(--sand)' }} />
        <div style={{ position: 'absolute', top: 10, left: '12.5%', width: `${(currentIdx / (STEPS.length - 1)) * 75}%`, height: 1, background: 'var(--gold)', transition: 'width 0.6s ease' }} />

        {STEPS.map((step, i) => {
          const done = i <= currentIdx
          return (
            <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: done ? 'var(--gold)' : '#fff',
                border: `1.5px solid ${done ? 'var(--gold)' : 'var(--sand)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s ease',
              }}>
                {done && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <p style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: done ? 'var(--gold)' : 'var(--taupe)', textAlign: 'center', lineHeight: 1.4 }}>
                {STEP_LABEL[step]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [tracking, setTracking] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    fetch(`/api/user/orders?id=${id}`, {
      headers: { Authorization: `Bearer ${user.accessToken || ''}` },
    })
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setOrder(data.order)
        setItems(data.items || [])
        setTracking(data.tracking || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user, id])

  const fmtDate = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtTime = s => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtGBP = n => `£${Number(n).toFixed(2)}`

  return (
    <AccountLayout>
      {/* 面包屑 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <Link href="/account/orders" style={{ fontSize: 11, color: 'var(--taupe)', textDecoration: 'none', letterSpacing: '.06em' }}>My Orders</Link>
        <span style={{ color: 'var(--warm)', fontSize: 11 }}>›</span>
        <span style={{ fontSize: 11, color: 'var(--ink)' }}>{order?.order_number || '…'}</span>
      </div>

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center' }}>
          <div style={{ width: 22, height: 22, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : notFound ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--taupe)', marginBottom: 20 }}>Order not found.</p>
          <Link href="/account/orders" style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '.12em', textTransform: 'uppercase' }}>← Back to Orders</Link>
        </div>
      ) : order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 标题 + 状态 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>Order</p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: 'var(--ink)' }}>{order.order_number}</h1>
              <p style={{ fontSize: 12, color: 'var(--taupe)', marginTop: 4 }}>Placed {fmtDate(order.created_at)}</p>
            </div>
            {(() => {
              const s = STATUS_COLOR[order.status] || { bg: 'var(--mist)', text: 'var(--taupe)' }
              return (
                <span style={{ display: 'inline-block', padding: '5px 14px', background: s.bg, color: s.text, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', borderRadius: 2 }}>
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              )
            })()}
          </div>

          {/* 状态进度 */}
          {['paid','processing','shipped','delivered'].includes(order.status) && (
            <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '20px 24px 24px' }}>
              <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 4 }}>Order Progress</p>
              <OrderProgress status={order.status} />
            </div>
          )}

          {/* 物流追踪 */}
          {order.tracking_number && (
            <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Tracking</p>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 400 }}>{order.tracking_number}</p>
                  {order.tracking_carrier && <p style={{ fontSize: 10, color: 'var(--taupe)', marginTop: 2 }}>{order.tracking_carrier}</p>}
                </div>
              </div>

              {tracking.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {tracking.map((ev, i) => (
                    <div key={ev.id} style={{ display: 'flex', gap: 16, paddingBottom: i < tracking.length - 1 ? 16 : 0 }}>
                      {/* 时间线 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--sand)', marginTop: 4, flexShrink: 0 }} />
                        {i < tracking.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--sand)', marginTop: 4 }} />}
                      </div>
                      <div style={{ paddingBottom: i < tracking.length - 1 ? 4 : 0 }}>
                        <p style={{ fontSize: 12, color: i === 0 ? 'var(--ink)' : 'var(--deep)', fontWeight: i === 0 ? 400 : 300, marginBottom: 2 }}>{ev.message || ev.status}</p>
                        {ev.location && <p style={{ fontSize: 11, color: 'var(--taupe)', marginBottom: 2 }}>{ev.location}</p>}
                        {ev.event_time && <p style={{ fontSize: 10, color: 'var(--taupe)' }}>{fmtTime(ev.event_time)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--taupe)' }}>Tracking information will appear here once your order ships.</p>
              )}
            </div>
          )}

          {/* 订单商品 */}
          <div style={{ background: '#fff', border: '1px solid var(--sand)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--mist)' }}>
              <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Items</p>
            </div>
            {items.length === 0 ? (
              <p style={{ padding: '20px 24px', fontSize: 12, color: 'var(--taupe)' }}>Item details not available.</p>
            ) : items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 24px', borderBottom: i < items.length - 1 ? '1px solid var(--mist)' : 'none', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{item.product_name}</p>
                  {item.sku_description && <p style={{ fontSize: 11, color: 'var(--taupe)' }}>{item.sku_description}</p>}
                  <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 2 }}>Qty: {item.quantity}</p>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink)', flexShrink: 0 }}>{fmtGBP(item.line_total_gbp || item.unit_price_gbp * item.quantity)}</p>
              </div>
            ))}

            {/* 费用合计 */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--sand)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 40 }}>
                <p style={{ fontSize: 12, color: 'var(--taupe)' }}>Subtotal</p>
                <p style={{ fontSize: 12, color: 'var(--deep)', minWidth: 70, textAlign: 'right' }}>{fmtGBP(order.subtotal_gbp)}</p>
              </div>
              <div style={{ display: 'flex', gap: 40 }}>
                <p style={{ fontSize: 12, color: 'var(--taupe)' }}>Shipping</p>
                <p style={{ fontSize: 12, color: 'var(--deep)', minWidth: 70, textAlign: 'right' }}>
                  {parseFloat(order.shipping_gbp) === 0 ? 'Free' : fmtGBP(order.shipping_gbp)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 40, paddingTop: 8, borderTop: '1px solid var(--mist)' }}>
                <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400 }}>Total</p>
                <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400, minWidth: 70, textAlign: 'right' }}>{fmtGBP(order.total_gbp)}</p>
              </div>
            </div>
          </div>

          {/* 收货地址 */}
          <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '20px 24px' }}>
            <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 14 }}>Delivery Address</p>
            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.8 }}>
              {order.shipping_name}<br />
              {order.shipping_line1}<br />
              {order.shipping_line2 && <>{order.shipping_line2}<br /></>}
              {order.shipping_city}{order.shipping_postcode ? `, ${order.shipping_postcode}` : ''}<br />
              {order.shipping_country}
            </p>
          </div>

          {/* 支付方式 */}
          <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--taupe)' }}>Payment</p>
            <p style={{ fontSize: 12, color: 'var(--deep)', textTransform: 'capitalize' }}>{order.payment_method || '—'}</p>
          </div>

        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </AccountLayout>
  )
}
