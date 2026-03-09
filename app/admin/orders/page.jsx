'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const STATUS_OPTIONS = ['all', 'pending', 'paid', 'shipped', 'cancelled']
const STATUS_LABEL = { all: '全部', pending: '待处理', paid: '已付款', shipped: '已发货', cancelled: '已取消' }
const STATUS_COLOR = { paid: '#4ade80', pending: '#facc15', shipped: '#60a5fa', cancelled: '#f87171' }

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setUpdating(true)
    await supabase.from('orders').update({ status }).eq('id', id)
    await loadOrders()
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }))
    setUpdating(false)
  }

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter
    const matchSearch = !search || (o.customer_email || '').toLowerCase().includes(search.toLowerCase()) || (o.id || '').includes(search)
    return matchStatus && matchSearch
  })

  const fmt = n => `£${Number(n || 0).toFixed(2)}`
  const fmtDate = s => s ? new Date(s).toLocaleString('zh-CN') : '-'

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 80px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 24, fontWeight: 300, marginBottom: 20 }}>订单管理</h1>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索邮箱或订单号…"
            style={{ width: '100%', padding: '9px 14px', background: '#242220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.88)', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: filter === s ? '#B89B6A' : '#1f1f1f', color: filter === s ? '#fff' : '#666' }}>{STATUS_LABEL[s]}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: '#242220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          {loading ? <p style={{ color: 'rgba(255,255,255,0.22)', padding: 24 }}>加载中…</p> : filtered.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.22)', padding: 24, fontSize: 13 }}>暂无订单</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#242220' }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['订单号','客户','金额','状态','日期','操作'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} onClick={() => setSelected(o)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selected?.id === o.id ? '#1f1f1f' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace' }}>{(o.id || '').slice(0,8)}…</td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{o.customer_email || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#B89B6A', fontSize: 13 }}>{fmt(o.total_gbp)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: (STATUS_COLOR[o.status] || '#888') + '22', color: STATUS_COLOR[o.status] || '#888', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{STATUS_LABEL[o.status] || o.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <select value={o.status || ''} onChange={e => updateStatus(o.id, e.target.value)}
                        style={{ background: '#1A1816', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>
                        {['pending','paid','shipped','cancelled'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ width: 320, background: '#242220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24, overflow: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: 400 }}>订单详情</h2>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          {[['订单号', selected.id],['客户邮箱', selected.customer_email],['收件人', selected.shipping_name],['地址', selected.shipping_address],['城市', selected.shipping_city],['邮编', selected.shipping_postcode],['国家', selected.shipping_country],['金额', fmt(selected.total_gbp)],['状态', STATUS_LABEL[selected.status] || selected.status],['支付方式', selected.payment_method],['创建时间', fmtDate(selected.created_at)]].map(([label, val]) => val ? (
            <div key={label} style={{ marginBottom: 14 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, wordBreak: 'break-all' }}>{val}</p>
            </div>
          ) : null)}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>更新状态</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['pending','paid','shipped','cancelled'].map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={updating || selected.status === s}
                  style={{ padding: '9px', background: selected.status === s ? '#2a2a2a' : '#111', border: `1px solid ${selected.status === s ? (STATUS_COLOR[s] || '#333') : '#2a2a2a'}`, borderRadius: 6, color: selected.status === s ? (STATUS_COLOR[s] || '#fff') : '#666', fontSize: 12, cursor: selected.status === s ? 'default' : 'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
