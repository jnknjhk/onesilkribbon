'use client'
import { useState, useEffect } from 'react'
import { ConfirmDialog } from '@osr/core/components/admin/ConfirmDialog'

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', red: '#f87171', green: '#4ade80',
}

const fmt = iso => iso ? new Date(iso).toLocaleDateString('zh-CN') : '—'
const daysAgo = iso => Math.round((Date.now() - new Date(iso)) / 86400000)

export default function MaintenancePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selOrders, setSelOrders] = useState([])
  const [selSessions, setSelSessions] = useState([])
  const [confirm, setConfirm] = useState(null) // { action, ids, title, message }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/maintenance')
      setData(await res.json())
    } catch { setData(null) }
    setSelOrders([]); setSelSessions([])
    setLoading(false)
  }

  async function runCleanup() {
    if (!confirm) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirm.action, ids: confirm.ids }),
      })
      const result = await res.json()
      setMsg(result.error ? `失败：${result.error}` : `已清理 ${result.deleted} 条`)
      if (!result.error) await load()
    } catch (e) { setMsg('失败：' + e.message) }
    setBusy(false)
    setConfirm(null)
    setTimeout(() => setMsg(''), 4000)
  }

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  if (loading) return <p style={{ color: C.muted, fontSize: 13, padding: 40 }}>加载中…</p>

  const stale = data?.stalePending || []
  const sessions = data?.expiredSessions || []
  const missing = data?.missingItems || []

  return (
    <div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger
        loading={busy}
        onConfirm={runCleanup}
        onCancel={() => setConfirm(null)}
      />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>数据维护</h1>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8 }}>
          这里列出需要人工判断的数据。所有清理都由你手动触发，系统不会自动删除任何东西。
          <br />删除操作不可恢复，请确认后再执行。
        </p>
        {msg && <p style={{ marginTop: 12, fontSize: 13, color: msg.startsWith('失败') ? C.red : C.green }}>{msg}</p>}
      </div>

      {/* ── 缺商品明细的订单（只提示，不提供删除） ── */}
      <Card
        title="⚠️ 缺少商品明细的订单"
        sub="这些订单不知道客户买了什么，无法发货，需要你联系客户或查支付平台核对。系统不提供删除——它们是真实交易记录。"
        count={missing.length}
      >
        {missing.length === 0 ? <Empty text="没有这类订单 ✓" /> : (
          <Table head={['订单号', '状态', '金额', '客户', '下单时间']}>
            {missing.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #F0EDE8' }}>
                <Td mono>{o.order_number}</Td>
                <Td>{o.status}</Td>
                <Td>£{o.total_gbp}</Td>
                <Td>{o.customer_email}</Td>
                <Td>{fmt(o.created_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* ── 滞留的待付款订单 ── */}
      <Card
        title="滞留的待付款订单"
        sub={`客户点了结账但没完成支付，超过 ${data?.staleDays ?? 7} 天仍是待付款状态。删除后订单列表和客户统计会更干净。`}
        count={stale.length}
        action={selOrders.length > 0 && (
          <button onClick={() => setConfirm({
            action: 'deleteOrders', ids: selOrders,
            title: '删除待付款订单',
            message: `将永久删除选中的 ${selOrders.length} 笔待付款订单及其商品明细，无法恢复。确定继续？`,
          })} style={btnDanger}>删除选中的 {selOrders.length} 条</button>
        )}
      >
        {stale.length === 0 ? <Empty text="没有滞留订单 ✓" /> : (
          <Table head={['', '订单号', '金额', '客户', '支付方式', '滞留时长']}>
            {stale.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #F0EDE8' }}>
                <Td><input type="checkbox" checked={selOrders.includes(o.id)} onChange={() => toggle(selOrders, setSelOrders, o.id)} /></Td>
                <Td mono>{o.order_number}</Td>
                <Td>£{o.total_gbp}</Td>
                <Td>{o.customer_email}</Td>
                <Td>{o.payment_method}</Td>
                <Td>{daysAgo(o.created_at)} 天</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* ── 过期的 PayPal 临时数据 ── */}
      <Card
        title="过期的 PayPal 临时数据"
        sub="客户走 PayPal 但中途放弃时留下的临时记录，已过期，可安全删除。"
        count={sessions.length}
        action={selSessions.length > 0 && (
          <button onClick={() => setConfirm({
            action: 'deleteSessions', ids: selSessions,
            title: '清理过期数据',
            message: `将删除选中的 ${selSessions.length} 条过期临时记录。确定继续？`,
          })} style={btnDanger}>删除选中的 {selSessions.length} 条</button>
        )}
      >
        {sessions.length === 0 ? <Empty text="没有过期数据 ✓" /> : (
          <Table head={['', '关联单号', '创建时间', '过期时间']}>
            {sessions.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #F0EDE8' }}>
                <Td><input type="checkbox" checked={selSessions.includes(s.id)} onChange={() => toggle(selSessions, setSelSessions, s.id)} /></Td>
                <Td mono>{s.order_number}</Td>
                <Td>{fmt(s.created_at)}</Td>
                <Td>{fmt(s.expires_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}

const btnDanger = {
  padding: '8px 18px', background: C.red + '22', border: `1px solid ${C.red}`,
  borderRadius: 6, color: C.red, fontSize: 12, cursor: 'pointer',
}

function Card({ title, sub, count, action, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ color: C.ink, fontSize: 16, fontWeight: 400, marginBottom: 4 }}>
            {title} <span style={{ color: count > 0 ? C.gold : C.muted, fontSize: 14 }}>({count})</span>
          </h2>
          <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.7 }}>{sub}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Table({ head, children }) {
  return (
    <div className="admin-table-scroll" style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'auto' }}>
      <table className="admin-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {head.map((h, i) => (
              <th key={i} style={{ padding: '10px 14px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, mono }) {
  return <td style={{ padding: '10px 14px', fontSize: 12, color: C.sub, ...(mono ? { fontFamily: 'monospace', whiteSpace: 'nowrap' } : {}) }}>{children}</td>
}

function Empty({ text }) {
  return <p style={{ color: C.green, fontSize: 13, padding: '8px 0' }}>{text}</p>
}
