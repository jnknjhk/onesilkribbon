'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../lib/api'
import { money, ago, daysSince, date } from '../../lib/format'
import { ORDER_STATUS, ORDER_TABS, DEFAULT_ORDER_TAB } from '../../lib/status'
import { useUrlState } from '../../lib/url-state'
import {
  PageHeader, Card, Tabs, SearchInput, DataTable, Pager, Badge, Button, Checkbox, EmptyState,
  Notice, Modal, Field, Input, useToast, styles as s,
} from '../../ui'
import { CarrierSelect, carrierName, initialShipValue } from './ShipFields'
import { trackingUrlFor } from '../../lib/carriers'

const DEFAULTS = { tab: DEFAULT_ORDER_TAB, page: '1', q: '' }

export default function OrdersList() {
  const router = useRouter()
  const toast = useToast()
  const [get, set] = useUrlState(DEFAULTS)
  const tab = get('tab')
  const page = parseInt(get('page'), 10) || 1
  const q = get('q')

  const [search, setSearch] = useState(q)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [batchOpen, setBatchOpen] = useState(false)

  // 搜索框输入停顿 300ms 后再更新网址和请求
  useEffect(() => { setSearch(q) }, [q])
  useEffect(() => {
    if (search === q) return
    const t = setTimeout(() => set({ q: search, page: 1 }), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab, page: String(page) })
      if (q) params.set('q', q)
      setData(await api(`/api/admin/orders?${params}`))
    } catch (e) {
      toast.error('订单加载失败：' + e.message)
    }
    setLoading(false)
  }, [tab, page, q]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected([]) }, [tab, page, q])

  const orders = useMemo(() => data?.orders || [], [data])
  const counts = data?.counts || {}
  const selectable = tab === 'to_ship' || tab === 'shipped'
  const allSelected = orders.length > 0 && orders.every(o => selected.includes(o.order_number))
  const selectedOrders = useMemo(() => orders.filter(o => selected.includes(o.order_number)), [orders, selected])

  const columns = [
    ...(selectable ? [{
      key: 'sel', width: 40,
      header: <Checkbox checked={allSelected} onChange={v => setSelected(v ? orders.map(o => o.order_number) : [])} />,
      render: o => <Checkbox checked={selected.includes(o.order_number)} onChange={v => setSelected(list => v ? [...list, o.order_number] : list.filter(n => n !== o.order_number))} />,
    }] : []),
    { key: 'order', header: '订单', primary: true, render: o => (
      <>
        <div className={s.cellMain}><span className={s.mono}>{o.order_number}</span></div>
        <div className={s.cellSub}>{o.shipping_name || '—'} · {o.customer_email}</div>
      </>
    ) },
    { key: 'items', header: '商品', render: o => <span style={{ color: 'var(--text-2)' }}>{o.item_summary || <span className={s.muted}>无明细</span>}</span> },
    { key: 'country', header: '寄往', hideMobile: true, render: o => [o.shipping_city, o.shipping_country].filter(Boolean).join(', ') || '—' },
    { key: 'total', header: '金额', align: 'right', render: o => <span className={s.num}>{money(o.total_gbp)}</span> },
    { key: 'status', header: '状态', render: o => <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label || o.status}</Badge> },
    tab === 'to_ship'
      ? { key: 'wait', header: '已等待', align: 'right', render: o => {
          const d = daysSince(o.paid_at || o.created_at)
          return <span className={d >= 2 ? s.textDanger : s.muted}>{d <= 0 ? '今天' : `${d} 天`}</span>
        } }
      : { key: 'date', header: '下单', align: 'right', render: o => <span className={s.muted} title={date(o.created_at)}>{ago(o.created_at)}</span> },
  ]

  const tabs = ORDER_TABS.map(t => ({ key: t.key, label: t.label, count: counts[t.key] }))

  return (
    <div>
      <PageHeader title="订单" subtitle={tab === 'to_ship' ? '等得最久的排在最前面' : null}
        actions={selected.length > 0 && (
          <>
            <span className={s.muted} style={{ fontSize: 13 }}>已选 {selected.length} 单</span>
            <Button icon="printer" onClick={() => window.open(`/admin/orders/print?numbers=${encodeURIComponent(selected.join(','))}`, '_blank')}>打印装箱单</Button>
            {tab === 'to_ship' && <Button variant="primary" icon="truck" onClick={() => setBatchOpen(true)}>批量发货</Button>}
          </>
        )} />

      <Tabs tabs={tabs} value={tab} onChange={k => set({ tab: k, page: 1 })} />

      {tab === 'unpaid' && (
        <Notice tone="info" style={{ marginBottom: 14 }}>
          这里是打开了付款页但没付款的订单（不需要发货）。如果顾客之后完成付款，订单会自动变成“待发货”。
          放了很久的可以在「设置 → 数据维护」里清理。
        </Notice>
      )}

      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索订单号、顾客姓名或邮箱" style={{ flex: 1, minWidth: 220 }} />
        <Button icon="refresh" onClick={load} loading={loading && !!data}>刷新</Button>
      </div>

      <Card padded={false}>
        <DataTable
          loading={loading && !data}
          rows={orders}
          rowKey="id"
          columns={columns}
          rowClassName={o => selected.includes(o.order_number) && s.rowSelected}
          onRowClick={o => router.push(`/admin/orders/${encodeURIComponent(o.order_number)}`)}
          empty={<EmptyState icon={tab === 'to_ship' ? 'check' : 'package'}
            title={q ? '没有找到匹配的订单' : tab === 'to_ship' ? '没有待发货的订单' : '这里还没有订单'}
            text={tab === 'to_ship' && !q ? '新订单付款后会出现在这里' : null} />}
        />
        <Pager page={page} totalPages={data?.totalPages} total={data?.total} unit="单" onChange={p => set({ page: p })} />
      </Card>

      <BatchShip open={batchOpen} orders={selectedOrders} onClose={() => setBatchOpen(false)}
        onDone={() => { setBatchOpen(false); setSelected([]); load() }} />
    </div>
  )
}

// 批量发货：同一家快递，每单填自己的单号；逐单调用和单个发货完全相同的接口
function BatchShip({ open, orders, onClose, onDone }) {
  const toast = useToast()
  const [carrier, setCarrier] = useState(initialShipValue(null))
  const [numbers, setNumbers] = useState({})
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState({})

  useEffect(() => { if (open) { setNumbers({}); setResults({}) } }, [open])

  async function run() {
    setRunning(true)
    const name = carrierName(carrier)
    let ok = 0
    for (const o of orders) {
      const n = (numbers[o.order_number] || '').trim()
      if (!n || results[o.order_number]?.ok) continue
      try {
        const res = await api('/api/admin/ship', {
          method: 'POST',
          body: { orderNumber: o.order_number, trackingNumber: n, carrier: name, trackingUrl: trackingUrlFor(name, n) },
        })
        ok++
        setResults(r => ({ ...r, [o.order_number]: { ok: true, emailSent: res.emailSent !== false } }))
      } catch (e) {
        setResults(r => ({ ...r, [o.order_number]: { ok: false, error: e.message } }))
      }
    }
    setRunning(false)
    if (ok > 0) toast.success(`已发货 ${ok} 单`)
  }

  const filled = orders.filter(o => (numbers[o.order_number] || '').trim()).length
  const allDone = orders.length > 0 && orders.every(o => results[o.order_number]?.ok)

  return (
    <Modal open={open} title={`批量发货（${orders.length} 单）`} onClose={running ? undefined : (allDone ? onDone : onClose)} width={620}
      footer={allDone
        ? <Button variant="primary" onClick={onDone}>完成</Button>
        : <>
            <Button onClick={onClose} disabled={running}>取消</Button>
            <Button variant="primary" icon="truck" loading={running} disabled={!filled || !carrierName(carrier)} onClick={run}>
              发货并通知顾客（{filled} 单）
            </Button>
          </>}>
      <div className={s.stack}>
        <CarrierSelect value={carrier} onChange={setCarrier} />
        <div>
          {orders.map(o => {
            const r = results[o.order_number]
            return (
              <div key={o.order_number} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className={s.mono}>{o.order_number}</div>
                  <div className={s.cellSub}>{o.shipping_name} · {o.shipping_city}</div>
                  {r && <div style={{ fontSize: 12, marginTop: 2 }} className={r.ok ? s.textSuccess : s.textDanger}>
                    {r.ok ? (r.emailSent ? '已发货，已通知顾客' : '已发货，但通知邮件没发出去') : r.error}
                  </div>}
                </div>
                <Field>
                  <Input size="sm" placeholder="快递单号" value={numbers[o.order_number] || ''} disabled={r?.ok || running}
                    onChange={e => setNumbers(m => ({ ...m, [o.order_number]: e.target.value }))} />
                </Field>
              </div>
            )
          })}
        </div>
        <div className={s.fieldHint}>没填单号的订单会跳过，保持“待发货”。</div>
      </div>
    </Modal>
  )
}
