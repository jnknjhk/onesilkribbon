'use client'
import { useState, useEffect } from 'react'

const STATUS_OPTIONS = ['all','pending','paid','shipped','cancelled','refunded']
const STATUS_LABEL   = { all:'全部', pending:'待处理', paid:'已付款', shipped:'已发货', cancelled:'已取消', refunded:'已退款' }
const STATUS_COLOR   = { paid:'#4ade80', pending:'#facc15', shipped:'#60a5fa', cancelled:'#f87171', refunded:'#c084fc' }
const C = { bg:'#F5F3F0', white:'#fff', border:'#E8E4DF', gold:'#B89B6A', ink:'#1C1714', muted:'#A8A4A0', sub:'#6B6460' }

const fmt     = n => `£${Number(n||0).toFixed(2)}`
const fmtDate = s => s ? new Date(s).toLocaleString('zh-CN') : '—'
const inp = { width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:"'Jost',sans-serif" }

function Label({ children }) {
  return <p style={{ color:C.muted, fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8 }}>{children}</p>
}

function InfoRow({ label, val }) {
  return (
    <div style={{ marginBottom:8 }}>
      <span style={{ color:C.muted, fontSize:11 }}>{label}：</span>
      <span style={{ color: (!val || val === '—') ? C.muted : C.sub, fontSize:12, fontStyle: (!val || val === '—') ? 'italic' : 'normal' }}>
        {(!val || val === '—') ? '无' : val}
      </span>
    </div>
  )
}

export default function OrdersPage() {
  const [orders, setOrders]           = useState([])
  const [page, setPage]                = useState(1)
  const PAGE_SIZE = 30
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(null)
  const [orderItems, setOrderItems]   = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)

  // modals
  const [showShipModal, setShowShipModal]       = useState(false)
  const [showRefundModal, setShowRefundModal]   = useState(false)
  const [showCancelModal, setShowCancelModal]   = useState(false)
  const [showResendModal, setShowResendModal]   = useState(false)

  const [shipForm, setShipForm] = useState({ trackingNumber:'', carrier:'', trackingUrl:'' })
  const [refundReason, setRefundReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg]         = useState('')

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/orders')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch { setOrders([]) }
    setLoading(false)
  }

  async function selectOrder(order) {
    setSelected(order)
    setOrderItems([])
    setActionMsg('')
    setItemsLoading(true)
    try {
      const res = await fetch(`/api/admin/orders?itemsFor=${order.id}`)
      const data = await res.json()
      setOrderItems(data.items || [])
    } catch { setOrderItems([]) }
    setItemsLoading(false)
  }

  // ── 发货 ──────────────────────────────────────────────────────────────────
  async function handleShip() {
    if (!shipForm.trackingNumber || !shipForm.carrier) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          orderNumber: selected.order_number,
          trackingNumber: shipForm.trackingNumber,
          carrier: shipForm.carrier,
          trackingUrl: shipForm.trackingUrl || '',
        }),
      })
      if (res.ok) {
        // /api/email 已经用 service-role 权限把 status/tracking 字段写库并发送了通知邮件，
        // 这里只需要把本地状态同步一下，不需要（也不应该）再用匿名端 supabase 客户端写一次库。
        const updated = { ...selected, status:'shipped', tracking_number:shipForm.trackingNumber, tracking_carrier:shipForm.carrier, tracking_url:shipForm.trackingUrl || null, shipped_at:new Date().toISOString() }
        setOrders(prev => prev.map(o => o.id === selected.id ? updated : o))
        setSelected(updated)
        setShowShipModal(false)
        setShipForm({ trackingNumber:'', carrier:'', trackingUrl:'' })
        setActionMsg('✅ 发货成功，通知邮件已发送')
      } else {
        setActionMsg('❌ 发送邮件失败，请重试')
      }
    } catch (e) { setActionMsg('❌ 操作失败：' + e.message) }
    setActionLoading(false)
  }

  // ── 退款 ──────────────────────────────────────────────────────────────────
  async function handleRefund() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/refund', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: selected.id, reason: refundReason }),
      })
      const data = await res.json()
      if (data.success) {
        // /api/admin/refund 已经用 service role 权限把订单状态写库了，这里只需要同步本地 UI
        const updated = { ...selected, status:'refunded', refund_reason: refundReason }
        setOrders(prev => prev.map(o => o.id === selected.id ? updated : o))
        setSelected(updated)
        setShowRefundModal(false)
        setRefundReason('')
        setActionMsg('✅ 退款已处理')
      } else {
        setActionMsg('❌ 退款失败：' + (data.error || '请去 Stripe/PayPal 后台手动退款'))
      }
    } catch (e) { setActionMsg('❌ 操作失败：' + e.message) }
    setActionLoading(false)
  }

  // ── 取消订单 ──────────────────────────────────────────────────────────────
  async function handleCancel() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/orders', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id: selected.id, action:'cancel', reason: cancelReason }),
      })
      const data = await res.json()
      if (data.success) {
        const updated = { ...selected, status:'cancelled', cancel_reason: cancelReason }
        setOrders(prev => prev.map(o => o.id === selected.id ? updated : o))
        setSelected(updated)
        setShowCancelModal(false)
        setCancelReason('')
        setActionMsg('✅ 订单已取消')
      } else {
        setActionMsg('❌ 取消失败：' + (data.error || ''))
      }
    } catch (e) { setActionMsg('❌ 操作失败：' + e.message) }
    setActionLoading(false)
  }

  // ── 重新发送邮件 ──────────────────────────────────────────────────────────
  async function handleResend() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/resend-order-email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: selected.id }),
      })
      const data = await res.json()
      if (data.success) {
        setShowResendModal(false)
        setActionMsg('✅ 订单确认邮件已重新发送')
      } else {
        setActionMsg('❌ 发送失败：' + (data.error || ''))
      }
    } catch (e) { setActionMsg('❌ 操作失败：' + e.message) }
    setActionLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter
    const matchSearch = !search ||
      (o.customer_email||'').toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number||'').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [filter, search])

  return (
    <>
    <div className="admin-master-detail" style={{ display:'flex', gap:24, height:'calc(100vh - 80px)' }}>

      {/* ── 发货弹窗 ── */}
      {showShipModal && (
        <Modal title="📦 标记为已发货" onClose={() => setShowShipModal(false)}>
          <p style={{ fontSize:12, color:C.muted, marginBottom:20 }}>填写快递信息后，系统会自动发送发货通知邮件给客户</p>
          {[['快递单号 *','trackingNumber','如：JD0123456789'],['快递公司 *','carrier','如：Royal Mail / DHL / UPS'],['快递追踪链接','trackingUrl','可选，如 https://track.royalmail.com/...']].map(([label,key,ph]) => (
            <div key={key} style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:5 }}>{label}</label>
              <input value={shipForm[key]} onChange={e => setShipForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={inp} />
            </div>
          ))}
          <ModalActions>
            <button onClick={() => setShowShipModal(false)} style={{ flex:1, padding:'10px', background:C.white, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:'pointer' }}>取消</button>
            <button onClick={handleShip} disabled={actionLoading || !shipForm.trackingNumber || !shipForm.carrier}
              style={{ flex:1, padding:'10px', background:C.ink, border:'none', borderRadius:8, fontSize:12, cursor:'pointer', color:'#fff', opacity: actionLoading ? 0.6 : 1 }}>
              {actionLoading ? '处理中…' : '确认发货并通知客户'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* ── 退款弹窗 ── */}
      {showRefundModal && (
        <Modal title="💸 处理退款" onClose={() => setShowRefundModal(false)}>
          <p style={{ fontSize:12, color:C.muted, marginBottom:8 }}>订单：{selected?.order_number}</p>
          <p style={{ fontSize:12, color:C.muted, marginBottom:20 }}>金额：{fmt(selected?.total_gbp)}</p>
          <p style={{ fontSize:12, color:'#f87171', marginBottom:16, lineHeight:1.7 }}>
            ⚠️ 系统会尝试自动退款。如果失败，请手动去 Stripe 或 PayPal 后台处理退款。
          </p>
          <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:5 }}>退款原因（可选）</label>
          <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={3}
            placeholder="如：客户取消订单、商品缺货…"
            style={{ ...inp, resize:'vertical' }} />
          <ModalActions>
            <button onClick={() => setShowRefundModal(false)} style={{ flex:1, padding:'10px', background:C.white, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:'pointer' }}>取消</button>
            <button onClick={handleRefund} disabled={actionLoading}
              style={{ flex:1, padding:'10px', background:'#ef4444', border:'none', borderRadius:8, fontSize:12, cursor:'pointer', color:'#fff', opacity: actionLoading ? 0.6 : 1 }}>
              {actionLoading ? '处理中…' : '确认退款'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* ── 取消弹窗 ── */}
      {showCancelModal && (
        <Modal title="🚫 取消订单" onClose={() => setShowCancelModal(false)}>
          <p style={{ fontSize:12, color:C.muted, marginBottom:20 }}>取消订单 {selected?.order_number}，此操作不会自动退款。</p>
          <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:5 }}>取消原因（可选）</label>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
            placeholder="如：客户要求取消、商品缺货…"
            style={{ ...inp, resize:'vertical' }} />
          <ModalActions>
            <button onClick={() => setShowCancelModal(false)} style={{ flex:1, padding:'10px', background:C.white, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:'pointer' }}>返回</button>
            <button onClick={handleCancel} disabled={actionLoading}
              style={{ flex:1, padding:'10px', background:'#f87171', border:'none', borderRadius:8, fontSize:12, cursor:'pointer', color:'#fff', opacity: actionLoading ? 0.6 : 1 }}>
              {actionLoading ? '处理中…' : '确认取消'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* ── 重发邮件确认弹窗 ── */}
      {showResendModal && (
        <Modal title="📧 重新发送订单邮件" onClose={() => setShowResendModal(false)}>
          <p style={{ fontSize:13, color:C.sub, marginBottom:20, lineHeight:1.7 }}>
            将重新发送订单确认邮件至：<br />
            <strong>{selected?.customer_email}</strong>
          </p>
          <ModalActions>
            <button onClick={() => setShowResendModal(false)} style={{ flex:1, padding:'10px', background:C.white, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:'pointer' }}>取消</button>
            <button onClick={handleResend} disabled={actionLoading}
              style={{ flex:1, padding:'10px', background:C.gold, border:'none', borderRadius:8, fontSize:12, cursor:'pointer', color:'#fff', opacity: actionLoading ? 0.6 : 1 }}>
              {actionLoading ? '发送中…' : '确认发送'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* ── 左侧订单列表 ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h1 style={{ color:C.ink, fontSize:22, fontWeight:300 }}>订单管理</h1>
            <span style={{ fontSize:12, color:C.muted }}>共 {orders.length} 笔订单</span>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索订单号或客户邮箱…"
            style={{ ...inp, marginBottom:12 }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => setFilter(s)} className="admin-tap-target" style={{
                padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11,
                background: filter===s ? C.gold : '#1f1f1f',
                color: filter===s ? '#fff' : '#888',
              }}>{STATUS_LABEL[s]}</button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflow:'auto', background:C.white, border:`1px solid ${C.border}`, borderRadius:12 }}>
          {loading ? <p style={{ color:C.muted, padding:24 }}>加载中…</p>
            : filtered.length === 0 ? <p style={{ color:C.muted, padding:24, fontSize:13 }}>暂无订单</p>
            : (
              <table className="admin-list-table" style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ position:'sticky', top:0, background:C.white, zIndex:1 }}>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {['订单号','客户','金额','状态','日期'].map(h => (
                      <th key={h} style={{ padding:'11px 14px', textAlign:'left', color:C.muted, fontSize:10, letterSpacing:'.1em', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map(o => (
                    <tr key={o.id} onClick={() => selectOrder(o)}
                      style={{ borderBottom:'1px solid #F5F3F0', cursor:'pointer', background: selected?.id===o.id ? '#FBF8F4' : 'transparent' }}>
                      <td data-label="订单号" style={{ padding:'11px 14px', fontFamily:'monospace', fontSize:12, color:C.ink, fontWeight:500 }}>{o.order_number||'—'}</td>
                      <td data-label="客户" style={{ padding:'11px 14px', fontSize:12, color:C.sub }}>{o.customer_email||'—'}</td>
                      <td data-label="金额" style={{ padding:'11px 14px', fontSize:13, color:C.gold }}>{fmt(o.total_gbp)}</td>
                      <td data-label="状态" style={{ padding:'11px 14px' }}>
                        <span style={{ background:(STATUS_COLOR[o.status]||'#888')+'22', color:STATUS_COLOR[o.status]||'#888', fontSize:10, padding:'3px 9px', borderRadius:20 }}>
                          {STATUS_LABEL[o.status]||o.status}
                        </span>
                      </td>
                      <td data-label="日期" style={{ padding:'11px 14px', fontSize:11, color:C.muted }}>
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('zh-CN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, marginTop:16 }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="admin-tap-target"
              style={{ padding:'6px 14px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor: page===1 ? 'not-allowed' : 'pointer', opacity: page===1 ? 0.4 : 1 }}>
              上一页
            </button>
            <span style={{ fontSize:12, color:C.muted }}>第 {page} / {totalPages} 页 · 共 {filtered.length} 条</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="admin-tap-target"
              style={{ padding:'6px 14px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:6, fontSize:12, cursor: page===totalPages ? 'not-allowed' : 'pointer', opacity: page===totalPages ? 0.4 : 1 }}>
              下一页
            </button>
          </div>
        )}
      </div>

      {/* ── 右侧详情面板 ── */}
      {selected && (
        <div className="admin-detail-panel" style={{ width:380, background:C.white, border:`1px solid ${C.border}`, borderRadius:12, overflow:'auto', flexShrink:0, display:'flex', flexDirection:'column' }}>
          {/* 头部 */}
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <p style={{ fontFamily:'monospace', fontSize:13, color:C.ink, fontWeight:600 }}>{selected.order_number}</p>
              <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>{fmtDate(selected.created_at)}</p>
            </div>
            <button onClick={() => { setSelected(null); setOrderItems([]); setActionMsg('') }}
              style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
          </div>

          <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>

            {/* 操作反馈 */}
            {actionMsg && (
              <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:12,
                background: actionMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
                color: actionMsg.startsWith('✅') ? '#166534' : '#991b1b',
                border: `1px solid ${actionMsg.startsWith('✅') ? '#86efac' : '#fca5a5'}` }}>
                {actionMsg}
              </div>
            )}

            {/* 状态 */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <span style={{ background:(STATUS_COLOR[selected.status]||'#888')+'22', color:STATUS_COLOR[selected.status]||'#888', fontSize:11, padding:'4px 12px', borderRadius:20 }}>
                {STATUS_LABEL[selected.status]||selected.status}
              </span>
              <span style={{ fontSize:11, color:C.muted }}>{selected.payment_method?.toUpperCase()}</span>
            </div>

            {/* 商品明细 */}
            <div style={{ marginBottom:20, padding:14, background:'#FBF8F4', borderRadius:8, border:`1px solid ${C.border}` }}>
              <Label>购买商品</Label>
              {itemsLoading ? <p style={{ fontSize:12, color:C.muted }}>加载中…</p>
                : orderItems.length === 0 ? <p style={{ fontSize:12, color:C.muted }}>无商品记录</p>
                : (
                  <div>
                    {orderItems.map(item => (
                      <div key={item.id} style={{ paddingBottom:10, marginBottom:10, borderBottom:`1px solid ${C.border}` }}>
                        <p style={{ color:C.ink, fontSize:13, fontWeight:500, marginBottom:2 }}>{item.product_name}</p>
                        <p style={{ color:C.sub, fontSize:11, marginBottom:4 }}>{item.sku_description}</p>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <p style={{ color:C.muted, fontSize:11 }}>× {item.quantity}</p>
                          <p style={{ color:C.gold, fontSize:12 }}>{fmt(item.line_total_gbp)}</p>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:4 }}>
                      {selected.discount_gbp > 0 && <><span style={{ fontSize:11, color:C.muted }}>折扣</span><span style={{ fontSize:12, color:'#22c55e' }}>-{fmt(selected.discount_gbp)}</span></>}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                      <span style={{ fontSize:11, color:C.muted }}>运费</span>
                      <span style={{ fontSize:12, color:C.sub }}>{parseFloat(selected.shipping_gbp||0)===0 ? 'Free' : fmt(selected.shipping_gbp)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, paddingTop:6, borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:12, color:C.ink, fontWeight:500 }}>合计</span>
                      <span style={{ fontSize:14, color:C.ink, fontWeight:600 }}>{fmt(selected.total_gbp)}</span>
                    </div>
                  </div>
                )}
            </div>

            {/* 收货信息 */}
            <div style={{ marginBottom:20 }}>
              <Label>收货信息</Label>
              <InfoRow label="收件人" val={selected.shipping_name} />
              <InfoRow label="电话"   val={selected.phone} />
              <InfoRow label="地址"   val={[selected.shipping_line1, selected.shipping_line2].filter(Boolean).join(', ')} />
              <InfoRow label="城市"   val={selected.shipping_city} />
              <InfoRow label="邮编"   val={selected.shipping_postcode} />
              <InfoRow label="国家"   val={selected.shipping_country} />
            </div>

            {/* 配送信息 */}
            {(selected.tracking_number || selected.tracking_carrier) && (
              <div style={{ marginBottom:20 }}>
                <Label>配送信息</Label>
                <InfoRow label="快递单号" val={selected.tracking_number} />
                <InfoRow label="快递公司" val={selected.tracking_carrier} />
                {selected.tracking_url && (
                  <a href={selected.tracking_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:12, color:C.gold, textDecoration:'none' }}>
                    → 查看物流追踪
                  </a>
                )}
              </div>
            )}

            {/* 订单信息 */}
            <div style={{ marginBottom:20 }}>
              <Label>订单信息</Label>
              <InfoRow label="客户邮箱" val={selected.customer_email} />
              <InfoRow label="支付方式" val={selected.payment_method} />
              <InfoRow label="Payment ID" val={selected.payment_intent_id} />
              <InfoRow label="创建时间" val={fmtDate(selected.created_at)} />
              <InfoRow label="付款时间" val={fmtDate(selected.paid_at)} />
              <InfoRow label="发货时间" val={fmtDate(selected.shipped_at)} />
            </div>

            {/* 操作按钮 */}
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
              <Label>操作</Label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

                {/* 发货 */}
                {['paid','pending'].includes(selected.status) && (
                  <button onClick={() => { setShowShipModal(true); setActionMsg('') }}
                    style={{ padding:'10px', background:C.ink, border:'none', borderRadius:8, color:'#fff', fontSize:12, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:8 }}>
                    📦 标记发货并通知客户
                  </button>
                )}

                {/* 更新快递单号（已发货的情况） */}
                {selected.status === 'shipped' && (
                  <button onClick={() => { setShowShipModal(true); setActionMsg('') }}
                    style={{ padding:'10px', background:'#1e3a5f', border:'none', borderRadius:8, color:'#fff', fontSize:12, cursor:'pointer' }}>
                    ✏️ 更新快递信息
                  </button>
                )}

                {/* 重新发送邮件 */}
                <button onClick={() => { setShowResendModal(true); setActionMsg('') }}
                  style={{ padding:'10px', background:C.gold, border:'none', borderRadius:8, color:'#fff', fontSize:12, cursor:'pointer' }}>
                  📧 重新发送订单确认邮件
                </button>

                {/* 退款 */}
                {['paid','shipped'].includes(selected.status) && (
                  <button onClick={() => { setShowRefundModal(true); setActionMsg('') }}
                    style={{ padding:'10px', background:'none', border:'1px solid #ef4444', borderRadius:8, color:'#ef4444', fontSize:12, cursor:'pointer' }}>
                    💸 处理退款
                  </button>
                )}

                {/* 取消订单 */}
                {['pending','paid'].includes(selected.status) && (
                  <button onClick={() => { setShowCancelModal(true); setActionMsg('') }}
                    style={{ padding:'10px', background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, fontSize:12, cursor:'pointer' }}>
                    🚫 取消订单
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:28, width:420, maxWidth:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:16, fontWeight:400, color:'#1C1714' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#A8A4A0' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ children }) {
  return <div style={{ display:'flex', gap:10, marginTop:20 }}>{children}</div>
}
