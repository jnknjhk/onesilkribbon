'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 12, padding: '24px 28px' }}>
      <p style={{ color: '#555', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 12 }}>{label}</p>
      <p style={{ color: color || '#fff', fontSize: 32, fontWeight: 300, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ color: '#444', fontSize: 12 }}>{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, products: 14, customers: 0, pending: 0, recentOrders: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: orders } = await supabase.from('orders').select('id, total_gbp, status, created_at, customer_email').order('created_at', { ascending: false }).limit(5)
      const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true })
      const { count: customerCount } = await supabase.from('orders').select('customer_email', { count: 'exact', head: true })
      const { data: revenueData } = await supabase.from('orders').select('total_gbp').eq('status', 'paid')
      const revenue = (revenueData || []).reduce((s, o) => s + (parseFloat(o.total_gbp) || 0), 0)
      const { count: pending } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      setStats({ orders: orderCount || 0, revenue, products: 14, customers: customerCount || 0, pending: pending || 0, recentOrders: orders || [] })
      setLoading(false)
    }
    load()
  }, [])

  const fmt = n => `£${Number(n).toFixed(2)}`
  const fmtDate = s => s ? new Date(s).toLocaleDateString('zh-CN') : '-'
  const statusColor = s => ({ paid: '#4ade80', pending: '#facc15', shipped: '#60a5fa', cancelled: '#f87171' }[s] || '#888')
  const statusLabel = s => ({ paid: '已付款', pending: '待处理', shipped: '已发货', cancelled: '已取消' }[s] || s)

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 300, marginBottom: 8 }}>总览</h1>
        <p style={{ color: '#555', fontSize: 13 }}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        <StatCard label="总订单数" value={loading ? '…' : stats.orders} sub="全部时间" />
        <StatCard label="总收入" value={loading ? '…' : fmt(stats.revenue)} sub="已付款订单" color="#B89B6A" />
        <StatCard label="待处理订单" value={loading ? '…' : stats.pending} sub="需要跟进" color={stats.pending > 0 ? '#facc15' : '#fff'} />
        <StatCard label="产品数量" value={stats.products} sub="14个产品，253个SKU" />
      </div>

      {/* Recent orders */}
      <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 400 }}>最近订单</h2>
          <a href="/admin/orders" style={{ color: '#B89B6A', fontSize: 12, textDecoration: 'none' }}>查看全部 →</a>
        </div>
        {loading ? (
          <p style={{ color: '#555', padding: 24, fontSize: 13 }}>加载中…</p>
        ) : stats.recentOrders.length === 0 ? (
          <p style={{ color: '#555', padding: 24, fontSize: 13 }}>暂无订单</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                {['订单号', '客户邮箱', '金额', '状态', '日期'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', color: '#444', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #1f1f1f' }}>
                  <td style={{ padding: '14px 24px', color: '#888', fontSize: 12 }}>{o.id.slice(0, 8)}…</td>
                  <td style={{ padding: '14px 24px', color: '#ccc', fontSize: 13 }}>{o.customer_email || '-'}</td>
                  <td style={{ padding: '14px 24px', color: '#B89B6A', fontSize: 13 }}>{fmt(o.total_gbp || 0)}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ background: statusColor(o.status) + '22', color: statusColor(o.status), fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 24px', color: '#555', fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
