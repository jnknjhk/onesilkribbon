'use client'
// 装箱单：一单一页，打印时自动隐藏后台的侧边栏和按钮
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { date } from '../../lib/format'
import { Button, Notice, SkeletonRows, styles as s } from '../../ui'

export default function PrintSlips() {
  const cfg = useAdminConfig()
  const numbers = useSearchParams().get('numbers') || ''
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!numbers) { setOrders([]); return }
    api(`/api/admin/orders?numbers=${encodeURIComponent(numbers)}`)
      .then(d => setOrders(d.orders || []))
      .catch(e => setError(e.message))
  }, [numbers])

  if (error) return <Notice tone="danger">{error}</Notice>
  if (!orders) return <SkeletonRows rows={8} />

  return (
    <div>
      <div className={s.noPrint} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div className={s.muted}>{orders.length} 张装箱单</div>
        <Button variant="primary" icon="printer" onClick={() => window.print()} disabled={!orders.length}>打印</Button>
      </div>
      {orders.length === 0 && <Notice tone="info">没有找到要打印的订单。</Notice>}
      {orders.map(o => (
        <div key={o.order_number} className={s.slip}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <h2>{cfg.brand}</h2>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{cfg.siteUrl.replace(/^https?:\/\//, '')} · {cfg.ownerEmail}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>装箱单 / Packing Slip</div>
              <div className={s.mono}>{o.order_number}</div>
              <div>{date(o.created_at)}</div>
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Ship to</div>
            <div style={{ fontWeight: 600 }}>{o.shipping_name}</div>
            <div>{o.shipping_line1}</div>
            {o.shipping_line2 && <div>{o.shipping_line2}</div>}
            <div>{[o.shipping_city, o.shipping_postcode].filter(Boolean).join(' ')}</div>
            <div>{o.shipping_country}</div>
            {o.phone && <div>{o.phone}</div>}
          </div>

          <table>
            <thead><tr><th>Item</th><th>Option</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ width: 40 }}>✓</th></tr></thead>
            <tbody>
              {(o.items || []).map(it => (
                <tr key={it.id}>
                  <td>{it.product_name}</td>
                  <td>{it.sku_description}</td>
                  <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                  <td>☐</td>
                </tr>
              ))}
              {(!o.items || o.items.length === 0) && <tr><td colSpan={4} style={{ color: '#b42318' }}>没有商品明细，请先核对</td></tr>}
            </tbody>
          </table>

          {/* 不打印内部备注：装箱单是放进包裹给顾客看的 */}
          <div style={{ marginTop: 32, fontSize: 13, color: '#555' }}>Thank you for your order — {cfg.brand}</div>
        </div>
      ))}
    </div>
  )
}
