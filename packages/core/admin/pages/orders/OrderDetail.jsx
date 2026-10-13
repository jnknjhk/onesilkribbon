'use client'
// 订单详情：有自己的网址（刷新不丢、能发给别人），顶部固定的操作栏只显示当前状态下该做的事。
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../lib/api'
import { money, dateTime } from '../../lib/format'
import { ORDER_STATUS, ORDER_TABS, CAN } from '../../lib/status'
import { isErased } from '../../lib/erasure'
import {
  PageHeader, Card, Badge, Button, ButtonLink, Modal, ConfirmDialog, Field, Textarea, Checkbox,
  Notice, EmptyState, SkeletonRows, Segmented, useToast, styles as s, cx,
} from '../../ui'
import ShipFields, { initialShipValue, carrierName, shipValueValid } from './ShipFields'

const EMAIL_KIND = {
  order_confirmation: '订单确认邮件', owner_notification: '新订单通知（发给你）', shipping: '发货通知',
  marketing: '后台手动发送', contact: '联系表单', contact_autoreply: '留言自动回复',
}

function backHref(status) {
  const tab = ORDER_TABS.find(t => t.statuses?.includes(status))?.key
  return `/admin/orders${tab ? `?tab=${tab}` : ''}`
}

export default function OrderDetail({ number }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // 'ship' | 'refund' | 'cancel' | 'resend' | 'deliver'

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/admin/orders?number=${encodeURIComponent(number)}`))
      setError('')
    } catch (e) { setError(e.message) }
  }, [number])
  useEffect(() => { load() }, [load])

  if (error) return <div><PageHeader title={number} back="/admin/orders" /><Notice tone="danger">{error}</Notice></div>
  if (!data) return <div><PageHeader title={number} back="/admin/orders" /><Card><SkeletonRows rows={6} /></Card></div>

  const { order, items, events, emails } = data
  const st = ORDER_STATUS[order.status] || { label: order.status, tone: 'neutral' }
  const done = () => { setModal(null); load() }
  const erased = isErased(order) // 客户已删除：没有联系方式了，不显示发邮件这类操作

  return (
    <div>
      <PageHeader
        back={backHref(order.status)}
        title={<span className={s.mono} style={{ fontSize: 20 }}>{order.order_number}</span>}
        subtitle={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={st.tone}>{st.label}</Badge>
          <span>{dateTime(order.created_at)} 下单</span>
          <span>· {String(order.payment_method || '').toUpperCase() || '—'}</span>
        </span>}
      />

      <div className={s.actionBar}>
        {order.status === 'paid' && <Button variant="primary" icon="truck" onClick={() => setModal('ship')}>发货</Button>}
        {order.status === 'shipped' && <Button variant="primary" icon="check" onClick={() => setModal('deliver')}>确认已送达</Button>}
        {order.status === 'shipped' && <Button icon="edit" onClick={() => setModal('ship')}>修改快递信息</Button>}
        {(order.status === 'paid' || order.status === 'shipped') && (
          <Button icon="printer" onClick={() => window.open(`/admin/orders/print?numbers=${encodeURIComponent(order.order_number)}`, '_blank')}>打印装箱单</Button>
        )}
        {!erased && <ButtonLink icon="mail" href={`/admin/marketing?tab=email&order=${encodeURIComponent(order.order_number)}`}>给顾客发邮件</ButtonLink>}
        {!erased && CAN.resend(order.status) && <Button variant="ghost" icon="send" onClick={() => setModal('resend')}>重发确认邮件</Button>}
        <span style={{ flex: 1 }} />
        {CAN.refund(order.status) && <Button variant="dangerGhost" icon="refund" onClick={() => setModal('refund')}>退款</Button>}
        {CAN.cancel(order.status) && <Button variant="dangerGhost" icon="x" onClick={() => setModal('cancel')}>取消订单</Button>}
      </div>

      {erased && (
        <Notice tone="info" style={{ marginBottom: 16 }}>这位客户已经删除，订单上的姓名、邮箱、地址和电话已抹去。金额和商品保留作财务记录。</Notice>
      )}
      {order.status === 'pending' && (
        <Notice tone="info" style={{ marginBottom: 16 }}>顾客还没有付款，不需要发货。顾客完成付款后这单会自动变成“待发货”。</Notice>
      )}

      <div className={s.split}>
        <div className={s.stack}>
          <Card title="商品" subtitle={`${items.reduce((n, i) => n + (i.quantity || 0), 0)} 件`}>
            {items.length === 0
              ? <Notice tone="warning">这单没有商品明细（写入失败或数据缺失），发货前请到支付后台核对顾客买了什么。</Notice>
              : items.map(it => (
                <div key={it.id} className={s.itemRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={s.cellMain}>{it.product_name}</div>
                    {it.sku_description && <div className={s.cellSub}>{it.sku_description}</div>}
                  </div>
                  <div className={s.num} style={{ color: 'var(--text-2)' }}>{money(it.unit_price_gbp)} × {it.quantity}</div>
                  <div className={s.num} style={{ width: 80, textAlign: 'right', fontWeight: 500 }}>{money(it.line_total_gbp)}</div>
                </div>
              ))}
            <div className={s.totals} style={{ marginTop: 10 }}>
              <div><span className={s.muted}>小计</span><span className={s.num}>{money(order.subtotal_gbp)}</span></div>
              {parseFloat(order.discount_gbp) > 0 && <div><span className={s.muted}>折扣</span><span className={cx(s.num, s.textSuccess)}>−{money(order.discount_gbp)}</span></div>}
              <div><span className={s.muted}>运费</span><span className={s.num}>{parseFloat(order.shipping_gbp || 0) === 0 ? '免运费' : money(order.shipping_gbp)}</span></div>
              <div className={s.totalGrand}><span>合计</span><span className={s.num}>{money(order.total_gbp)}</span></div>
            </div>
          </Card>

          <Card title="进度">
            <Timeline order={order} events={events} emails={emails} />
          </Card>
        </div>

        <div className={s.stack}>
          {erased ? (
            <Card title="顾客">
              <dl className={s.kv}>
                <dt>姓名</dt><dd>{order.shipping_name}</dd>
                <dt>国家</dt><dd>{order.shipping_country || '—'}</dd>
              </dl>
            </Card>
          ) : (
            <Card title="顾客" actions={<ButtonLink size="sm" variant="ghost" href={`/admin/customers?email=${encodeURIComponent(order.customer_email)}`}>客户详情</ButtonLink>}>
              <dl className={s.kv}>
                <dt>姓名</dt><dd>{order.shipping_name || '—'}</dd>
                <dt>邮箱</dt><dd><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd>
                <dt>电话</dt><dd>{order.phone || '—'}</dd>
                <dt>收货地址</dt><dd><Address order={order} /></dd>
              </dl>
            </Card>
          )}

          {(order.tracking_number || order.tracking_carrier) && (
            <Card title="快递">
              <dl className={s.kv}>
                <dt>快递公司</dt><dd>{order.tracking_carrier || '—'}</dd>
                <dt>单号</dt><dd className={s.mono}>{order.tracking_number || '—'}</dd>
                {order.tracking_url && <><dt>追踪</dt><dd><a href={order.tracking_url} target="_blank" rel="noopener noreferrer">打开追踪页面 ↗</a></dd></>}
              </dl>
            </Card>
          )}

          <Card title="付款">
            <dl className={s.kv}>
              <dt>方式</dt><dd>{order.payment_method || '—'}</dd>
              <dt>付款编号</dt><dd className={s.mono} style={{ fontSize: 12 }}>{order.payment_intent_id || '—'}</dd>
              {order.cancel_reason && <><dt>取消原因</dt><dd>{order.cancel_reason}</dd></>}
              {order.refund_reason && <><dt>退款原因</dt><dd>{order.refund_reason}</dd></>}
            </dl>
          </Card>

          <NoteCard order={order} onSaved={load} />
        </div>
      </div>

      {modal === 'ship' && <ShipModal order={order} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'refund' && <RefundModal order={order} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'cancel' && <CancelModal order={order} onClose={() => setModal(null)} onDone={done} />}
      <ConfirmDialog open={modal === 'resend'} title="重新发送订单确认邮件"
        message={`将重新发送订单确认邮件给 ${order.customer_email}。`} confirmLabel="发送"
        onCancel={() => setModal(null)}
        onConfirm={async () => {
          try { await api('/api/admin/resend-order-email', { method: 'POST', body: { orderId: order.id } }); toast.success('确认邮件已重新发送'); done() }
          catch (e) { toast.error('发送失败：' + e.message) }
        }} />
      <ConfirmDialog open={modal === 'deliver'} title="确认已送达" confirmLabel="确认送达"
        message="物流没有自动回传签收时，用这个手动把订单标记为已送达。"
        onCancel={() => setModal(null)}
        onConfirm={async () => {
          try { await api('/api/admin/orders', { method: 'PATCH', body: { id: order.id, action: 'deliver' } }); toast.success('已标记为送达'); done() }
          catch (e) { toast.error(e.message) }
        }} />
    </div>
  )
}

function Address({ order }) {
  const toast = useToast()
  const lines = [order.shipping_name, order.shipping_line1, order.shipping_line2, [order.shipping_city, order.shipping_postcode].filter(Boolean).join(' '), order.shipping_country].filter(Boolean)
  return (
    <div>
      {lines.slice(1).map((l, i) => <div key={i}>{l}</div>)}
      <Button size="sm" variant="ghost" icon="copy" style={{ marginTop: 6, marginLeft: -10 }}
        onClick={async () => {
          try { await navigator.clipboard.writeText(lines.join('\n')); toast.success('地址已复制') }
          catch { toast.error('复制失败，请手动选择') }
        }}>复制地址</Button>
    </div>
  )
}

function Timeline({ order, events, emails }) {
  const steps = [
    { at: order.created_at, title: '下单' },
    order.paid_at && { at: order.paid_at, title: '付款成功' },
    order.shipped_at && { at: order.shipped_at, title: `已发货${order.tracking_carrier ? ` · ${order.tracking_carrier}` : ''}` },
    ...(events || []).filter(e => e.status !== 'Dispatched' && e.status !== 'Delivered').map(e => ({ at: e.event_time, title: e.message || e.status, meta: e.location })),
    order.delivered_at && { at: order.delivered_at, title: '已送达' },
    order.cancelled_at && { at: order.cancelled_at, title: '订单已取消', meta: order.cancel_reason },
    order.status === 'refunded' && { at: null, title: '已退款', meta: order.refund_reason },
    ...(emails || []).map(m => ({ at: m.created_at, title: `${EMAIL_KIND[m.kind] || m.kind}${m.status === 'failed' ? '（发送失败）' : ''}`, meta: m.status === 'failed' ? m.error : m.to_email, failed: m.status === 'failed', email: true })),
  ].filter(Boolean).sort((a, b) => (a.at ? new Date(a.at) : Infinity) - (b.at ? new Date(b.at) : Infinity))

  return (
    <ul className={s.timeline}>
      {steps.map((st, i) => (
        <li key={i} className={cx(!st.email && s.timelineDone)}>
          <div className={cx(s.timelineTitle, st.failed && s.textDanger)}>{st.title}</div>
          <div className={s.timelineMeta}>{st.at ? dateTime(st.at) : ''}{st.meta ? `${st.at ? ' · ' : ''}${st.meta}` : ''}</div>
        </li>
      ))}
    </ul>
  )
}

function NoteCard({ order, onSaved }) {
  const toast = useToast()
  const [text, setText] = useState(order.notes || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setText(order.notes || '') }, [order.notes])
  const dirty = (text || '') !== (order.notes || '')
  return (
    <Card title="内部备注" subtitle="只有后台能看到，顾客看不到">
      <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="比如：顾客要求周五前寄出、包装加一张卡片…" style={{ minHeight: 80 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} loading={saving}
          onClick={async () => {
            setSaving(true)
            try { await api('/api/admin/orders', { method: 'PATCH', body: { id: order.id, action: 'note', notes: text } }); toast.success('备注已保存'); onSaved() }
            catch (e) { toast.error('保存失败：' + e.message) }
            setSaving(false)
          }}>保存备注</Button>
      </div>
    </Card>
  )
}

function ShipModal({ order, onClose, onDone }) {
  const toast = useToast()
  const [value, setValue] = useState(() => initialShipValue(order))
  const [saving, setSaving] = useState(false)
  const editing = order.status === 'shipped'
  return (
    <Modal open title={editing ? '修改快递信息' : '发货'} onClose={saving ? undefined : onClose}
      footer={<>
        <Button onClick={onClose} disabled={saving}>取消</Button>
        <Button variant="primary" icon="truck" loading={saving} disabled={!shipValueValid(value)}
          onClick={async () => {
            setSaving(true)
            try {
              const res = await api('/api/admin/ship', { method: 'POST', body: {
                orderNumber: order.order_number, trackingNumber: value.trackingNumber.trim(),
                carrier: carrierName(value), trackingUrl: value.trackingUrl.trim(),
              } })
              if (res.emailSent === false) toast.error('已标记发货，但通知邮件没发出去（可在邮件记录里查看原因）')
              else toast.success(editing ? '快递信息已更新，已重新通知顾客' : '已发货，已通知顾客')
              onDone()
            } catch (e) { toast.error('发货失败：' + e.message); setSaving(false) }
          }}>{editing ? '保存并通知顾客' : '发货并通知顾客'}</Button>
      </>}>
      <p className={s.muted} style={{ marginTop: 0, fontSize: 13 }}>保存后系统会自动给顾客发一封发货通知邮件，里面带快递单号和追踪链接。</p>
      <ShipFields value={value} onChange={setValue} />
    </Modal>
  )
}

function RefundModal({ order, onClose, onDone }) {
  const toast = useToast()
  const canAuto = order.payment_method === 'stripe'
  const [mode, setMode] = useState(canAuto ? 'auto' : 'manual')
  const [reason, setReason] = useState('')
  // 还没发货的，货还在手上，默认把库存加回去；已发出的默认不加
  const [restock, setRestock] = useState(order.status === 'paid')
  const [saving, setSaving] = useState(false)
  return (
    <Modal open title="退款" onClose={saving ? undefined : onClose}
      footer={<>
        <Button onClick={onClose} disabled={saving}>取消</Button>
        <Button variant="danger" loading={saving} onClick={async () => {
          setSaving(true)
          try {
            const res = await api('/api/admin/refund', { method: 'POST', body: { orderId: order.id, reason, manual: mode === 'manual', restock } })
            if (res.success === false) { toast.error(res.error); if (res.needsManual) setMode('manual'); setSaving(false); return }
            toast.success(`已退款${res.restocked ? `，已加回 ${res.restocked.ok} 件库存` : ''}`)
            if (res.restocked?.failed) toast.error(`有 ${res.restocked.failed} 个 SKU 的库存没能加回，请到商品里手动调整`)
            onDone()
          } catch (e) { toast.error('退款失败：' + e.message); setSaving(false) }
        }}>{mode === 'auto' ? `确认退款 ${money(order.total_gbp)}` : '标记为已退款'}</Button>
      </>}>
      <div className={s.stack}>
        <Field label="退款方式" group>
          <Segmented value={mode} onChange={setMode} options={[
            ...(canAuto ? [{ value: 'auto', label: '通过 Stripe 自动退款' }] : []),
            { value: 'manual', label: '我已在支付后台手动退款' },
          ]} />
        </Field>
        {mode === 'auto'
          ? <Notice tone="warning">会立即通过 Stripe 把 {money(order.total_gbp)} 全额退给顾客，不能撤销。</Notice>
          : <Notice tone="info">
              {order.payment_method === 'paypal' ? 'PayPal 订单需要先在 PayPal 后台退款。' : '请先在支付后台完成退款。'}
              这里只把订单记录为“已退款”，不会再动钱。
            </Notice>}
        <Field label="退款原因（可选）">
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="比如：顾客取消、商品缺货…" style={{ minHeight: 70 }} />
        </Field>
        <Checkbox checked={restock} onChange={setRestock}>把这单的商品数量加回库存（货没寄出或已退回时勾选）</Checkbox>
      </div>
    </Modal>
  )
}

function CancelModal({ order, onClose, onDone }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <Modal open title="取消订单" onClose={saving ? undefined : onClose}
      footer={<>
        <Button onClick={onClose} disabled={saving}>返回</Button>
        <Button variant="danger" loading={saving} onClick={async () => {
          setSaving(true)
          try { await api('/api/admin/orders', { method: 'PATCH', body: { id: order.id, action: 'cancel', reason } }); toast.success('订单已取消'); onDone() }
          catch (e) { toast.error(e.message); setSaving(false) }
        }}>确认取消</Button>
      </>}>
      <div className={s.stack}>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>这单还没付款，取消后不会产生任何扣款或退款。</p>
        <Notice tone="warning">如果顾客的付款页面还开着、之后又付了款，这单会保持“已取消”，需要你手动核对。</Notice>
        <Field label="取消原因（可选）">
          <Textarea value={reason} onChange={e => setReason(e.target.value)} style={{ minHeight: 70 }} />
        </Field>
      </div>
    </Modal>
  )
}
