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
  const [orderItems, setOrderItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showShipModal, setShowShipModal] = useState(false)
  const [shipForm, setShipForm] = useState({ trackingNumber: '', carrier: '', trackingUrl: '' })
  const [shipping, setShipping] = useState(false)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function selectOrder(order) {
    setSelected(order)
    setOrderItems([])
    setItemsLoading(true)
    const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id).order('created_at', { ascending: true })
    setOrderItems(data || [])
    setItemsLoading(false)
  }

  async function updateStatus(id, status) {
    if (status === 'shipped') { setShowShipModal(true); return }
    setUpdating(true)
    await supabase.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }))
    setUpdating(false)
  }

  async function handleShip() {
    if (!shipForm.trackingNumber || !shipForm.carrier) return
    setShipping(true)
    try {
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: selected.order_number,
          trackingNumber: shipForm.trackingNumber,
          carrier: shipForm.carrier,
          trackingUrl: shipForm.trackingUrl || '',
        }),
      })
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'shipped' } : o))
      setSelected(prev => ({ ...prev, status: 'shipped', tracking_number: shipForm.trackingNumber }))
      setShowShipModal(false)
      setShipForm({ trackingNumber: '', carrier: '', trackingUrl: '' })
    } catch (e) { console.error(e) }
    setShipping(false)
  }

  async function deleteOrder(id) {
    if (!confirm('确认删除该订单？此操作不可撤销。')) return
    setDeleting(true)
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
    if (selected?.id === id) { setSelected(null); setOrderItems([]) }
    setDeleting(false)
  }

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter
    const matchSearch = !search || (o.customer_email || '').toLowerCase().includes(search.toLowerCase()) || (o.order_number || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const fmt = n => `£${Number(n || 0).toFixed(2)}`
  const fmtDate = s => s ? new Date(s).toLocaleString('zh-CN') : '-'

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 80px)' }}>

      {/* 发货弹窗 */}
      {showShipModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 400 }}>
            <h3 style={{ color: '#1C1714', fontSize: 16, fontWeight: 400, marginBottom: 20 }}>标记为已发货</h3>
            <p style={{ fontSize: 12, color: '#A8A4A0', marginBottom: 20 }}>填写快递信息后，系统会自动发送发货通知邮件给客户</p>
            {[['快递单号 *', 'trackingNumber', '如：JD0123456789'], ['快递公司 *', 'carrier', '如：Royal Mail / DHL / UPS'], ['快递追踪链接', 'trackingUrl', '可选']].map(([label, key, placeholder]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#A8A4A0', display: 'block', marginBottom: 5 }}>{label}</label>
                <input value={shipForm[key]} onChange={e => setShipForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E8E4DF', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowShipModal(false)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #E8E4DF', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#6B6460' }}>取消</button>
              <button onClick={handleShip} disabled={shipping || !shipForm.trackingNumber || !shipForm.carrier}
                style={{ flex: 1, padding: '10px', background: '#1C1714', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#fff' }}>
                {shipping ? '处理中…' : '确认发货并通知客户'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 左侧列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#1C1714', fontSize: 24, fontWeight: 300, marginBottom: 20 }}>订单管理</h1>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索邮箱或订单号…"
            style={{ width: '100%', padding: '9px 14px', background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 8, color: '#1C1714', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: filter === s ? '#B89B6A' : '#1f1f1f', color: filter === s ? '#fff' : '#666' }}>{STATUS_LABEL[s]}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12 }}>
          {loading ? <p style={{ color: '#A8A4A0', padding: 24 }}>加载中…</p> : filtered.length === 0 ? (
            <p style={{ color: '#A8A4A0', padding: 24, fontSize: 13 }}>暂无订单</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#FFFFFF' }}>
                <tr style={{ borderBottom: '1px solid #E8E4DF' }}>
                  {['订单号','客户','金额','状态','日期','操作','删除'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#8A8480', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} onClick={() => selectOrder(o)} style={{ borderBottom: '1px solid #F0EDE8', cursor: 'pointer', background: selected?.id === o.id ? '#FBF8F4' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', color: '#1C1714', fontSize: 12, fontFamily: 'monospace', fontWeight: 500 }}>{o.order_number || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#504C48', fontSize: 12 }}>{o.customer_email || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#B89B6A', fontSize: 13 }}>{fmt(o.total_gbp)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: (STATUS_COLOR[o.status] || '#888') + '22', color: STATUS_COLOR[o.status] || '#888', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{STATUS_LABEL[o.status] || o.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#A8A4A0', fontSize: 11 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <select value={o.status || ''} onChange={e => { setSelected(o); updateStatus(o.id, e.target.value) }}
                        style={{ background: '#F5F3F0', border: '1px solid #DDD8D2', borderRadius: 6, color: '#504C48', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>
                        {['pending','paid','shipped','cancelled'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteOrder(o.id)} disabled={deleting}
                        style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      {selected && (
        <div style={{ width: 360, background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, padding: 24, overflow: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ color: '#1C1714', fontSize: 15, fontWeight: 400 }}>订单详情</h2>
            <button onClick={() => { setSelected(null); setOrderItems([]) }} style={{ background: 'none', border: 'none', color: '#A8A4A0', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>

          {/* 商品明细 */}
          <div style={{ marginBottom: 20, padding: 16, background: '#FBF8F4', borderRadius: 8, border: '1px solid #E8E4DF' }}>
            <p style={{ color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>购买商品</p>
            {itemsLoading ? <p style={{ color: '#A8A4A0', fontSize: 12 }}>加载中…</p>
              : orderItems.length === 0 ? <p style={{ color: '#A8A4A0', fontSize: 12 }}>无商品记录</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orderItems.map(item => (
                    <div key={item.id} style={{ paddingBottom: 10, borderBottom: '1px solid #E8E4DF' }}>
                      <p style={{ color: '#1C1714', fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{item.product_name}</p>
                      <p style={{ color: '#6B6460', fontSize: 12, marginBottom: 4 }}>{item.sku_description}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <p style={{ color: '#A8A4A0', fontSize: 12 }}>× {item.quantity}</p>
                        <p style={{ color: '#B89B6A', fontSize: 13 }}>{fmt(item.line_total_gbp)}</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                    <p style={{ color: '#8A8480', fontSize: 12 }}>合计</p>
                    <p style={{ color: '#1C1714', fontSize: 13, fontWeight: 500 }}>{fmt(selected.total_gbp)}</p>
                  </div>
                </div>
              )}
          </div>

          {/* 收货信息 */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>收货信息</p>
            {[
              ['收件人', selected.shipping_name],
              ['电话', selected.phone],
              ['地址', selected.shipping_line1],
              ['城市', selected.shipping_city],
              ['邮编', selected.shipping_postcode],
              ['国家', selected.shipping_country],
            ].map(([label, val]) => val ? (
              <div key={label} style={{ marginBottom: 8 }}>
                <span style={{ color: '#A8A4A0', fontSize: 11 }}>{label}：</span>
                <span style={{ color: '#504C48', fontSize: 12 }}>{val}</span>
              </div>
            ) : null)}
          </div>

          {/* 订单信息 */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>订单信息</p>
            {[
              ['订单号', selected.order_number],
              ['客户邮箱', selected.customer_email],
              ['运费', fmt(selected.shipping_gbp)],
              ['支付方式', selected.payment_method],
              ['快递单号', selected.tracking_number],
              ['创建时间', fmtDate(selected.created_at)],
              ['付款时间', fmtDate(selected.paid_at)],
              ['发货时间', fmtDate(selected.shipped_at)],
            ].map(([label, val]) => val && val !== '£0.00' && val !== '-' ? (
              <div key={label} style={{ marginBottom: 8 }}>
                <span style={{ color: '#A8A4A0', fontSize: 11 }}>{label}：</span>
                <span style={{ color: '#504C48', fontSize: 12 }}>{val}</span>
              </div>
            ) : null)}
          </div>

          {/* 更新状态 */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #E8E4DF' }}>
            <p style={{ color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>更新状态</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['pending','paid','shipped','cancelled'].map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={updating || selected.status === s}
                  style={{ padding: '9px', background: selected.status === s ? '#2a2a2a' : '#111', border: `1px solid ${selected.status === s ? (STATUS_COLOR[s] || '#333') : '#2a2a2a'}`, borderRadius: 6, color: selected.status === s ? (STATUS_COLOR[s] || '#fff') : '#666', fontSize: 12, cursor: selected.status === s ? 'default' : 'pointer' }}>
                  {s === 'shipped' ? '📦 标记发货并通知客户' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => deleteOrder(selected.id)} disabled={deleting}
              style={{ width: '100%', padding: '9px', background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>删除此订单</button>
          </div>
        </div>
      )}
    </div>
  )
}
