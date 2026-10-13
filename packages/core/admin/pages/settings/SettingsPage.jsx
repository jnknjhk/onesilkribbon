'use client'
// 设置：店铺设置（运费、低库存提醒）和数据维护。
// 运费原来在"营销"里，数据维护原来是单独一个菜单。
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { money, date, daysSince } from '../../lib/format'
import { useUrlState } from '../../lib/url-state'
import {
  PageHeader, Card, Tabs, DataTable, Badge, Button, Field, Input, Segmented, Checkbox, ConfirmDialog,
  EmptyState, Notice, SkeletonRows, useToast, useUnsavedWarning, styles as s,
} from '../../ui'
import { ORDER_STATUS } from '../../lib/status'

// 没设置过时前台用的默认值（和旧版后台一致）
const SHIPPING_DEFAULTS = { shipping_rate: '3.95', free_shipping_threshold: '45.00', free_shipping_enabled: 'true' }

export default function SettingsPage() {
  const cfg = useAdminConfig()
  const [get, set] = useUrlState({ tab: 'store' })
  const tabs = [
    { key: 'store', label: '店铺设置' },
    ...(cfg.features.maintenance ? [{ key: 'maintenance', label: '数据维护' }] : []),
  ]
  const tab = tabs.some(t => t.key === get('tab')) ? get('tab') : 'store'
  return (
    <div>
      <PageHeader title="设置" />
      <Tabs value={tab} onChange={v => set({ tab: v })} tabs={tabs} />
      {tab === 'maintenance' ? <Maintenance /> : <StoreSettings />}
    </div>
  )
}

function StoreSettings() {
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const baseline = useRef('')

  useEffect(() => {
    api('/api/admin/settings').then(({ settings = {} }) => {
      // 和旧版一样：数据库里还没有运费设置时显示默认值
      const next = {
        ...(settings.shipping_rate ? {
          shipping_rate: settings.shipping_rate,
          free_shipping_threshold: settings.free_shipping_threshold || SHIPPING_DEFAULTS.free_shipping_threshold,
          free_shipping_enabled: settings.free_shipping_enabled ?? SHIPPING_DEFAULTS.free_shipping_enabled,
        } : SHIPPING_DEFAULTS),
        low_stock_threshold: settings.low_stock_threshold ?? '3',
      }
      baseline.current = JSON.stringify(next)
      setForm(next)
    }).catch(e => toast.error('设置加载失败：' + e.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = form && JSON.stringify(form) !== baseline.current
  useUnsavedWarning(dirty)
  if (!form) return <Card><SkeletonRows rows={5} /></Card>

  const setF = patch => setForm(p => ({ ...p, ...patch }))
  const freeOn = form.free_shipping_enabled === 'true'

  async function save() {
    const rate = parseFloat(form.shipping_rate)
    const threshold = parseFloat(form.free_shipping_threshold)
    const low = parseInt(form.low_stock_threshold, 10)
    if (!(rate >= 0)) { toast.error('运费请填一个数字'); return }
    if (freeOn && !(threshold >= 0)) { toast.error('免运费门槛请填一个数字'); return }
    if (!(low >= 0)) { toast.error('低库存提醒请填 0 或以上的整数'); return }
    setSaving(true)
    try {
      await api('/api/admin/settings', { method: 'POST', body: form })
      baseline.current = JSON.stringify(form)
      toast.success('设置已保存，网站上立即生效')
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <div>
    <div style={{ maxWidth: 720 }} className={s.stack}>
      <Card title="运费" subtitle="结账时按这里的设置收运费">
        <div className={s.stack}>
          <div className={s.grid2}>
            <Field label="运费 (£)">
              <Input type="number" step="0.01" min="0" value={form.shipping_rate} onChange={e => setF({ shipping_rate: e.target.value })} />
            </Field>
            <Field label="满多少免运费 (£)">
              <Input type="number" step="0.01" min="0" value={form.free_shipping_threshold} disabled={!freeOn} onChange={e => setF({ free_shipping_threshold: e.target.value })} />
            </Field>
          </div>
          <Field label="免运费活动" group>
            <Segmented value={form.free_shipping_enabled} onChange={v => setF({ free_shipping_enabled: v })}
              options={[{ value: 'true', label: '开启' }, { value: 'false', label: '关闭' }]} />
          </Field>
          <Notice tone="info">
            现在：每单运费 {money(form.shipping_rate)}，{freeOn ? `满 ${money(form.free_shipping_threshold)} 免运费` : '免运费活动关闭，所有订单都收运费'}
          </Notice>
        </div>
      </Card>
      <Card title="库存提醒" subtitle="工作台和商品库存页按这个数提醒你补货">
        <Field label="库存少于等于多少算&quot;库存不足&quot;" hint="只影响后台提醒，不影响顾客下单">
          <Input type="number" min="0" step="1" value={form.low_stock_threshold} onChange={e => setF({ low_stock_threshold: e.target.value })} style={{ maxWidth: 160 }} />
        </Field>
      </Card>
    </div>
      <div className={s.saveBar}>
        <span className={s.saveBarMsg}>{dirty ? <><span className={s.dirtyDot} />有修改还没保存</> : '没有未保存的修改'}</span>
        <span style={{ flex: 1 }} />
        <Button variant="primary" icon="check" loading={saving} disabled={!dirty} onClick={save}>保存</Button>
      </div>
    </div>
  )
}

// ── 数据维护 ──────────────────────────────────────────────────────────────────
function Maintenance() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [selOrders, setSelOrders] = useState([])
  const [selSessions, setSelSessions] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api('/api/admin/maintenance')) } catch (e) { toast.error('加载失败：' + e.message); setData({}) }
    setSelOrders([]); setSelSessions([])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function run() {
    setBusy(true)
    try {
      const r = await api('/api/admin/maintenance', { method: 'POST', body: { action: confirm.action, ids: confirm.ids } })
      toast.success(`已清理 ${r.deleted} 条`)
      await load()
    } catch (e) { toast.error('清理失败：' + e.message) }
    setBusy(false); setConfirm(null)
  }

  if (!data) return <Card><SkeletonRows rows={6} /></Card>
  const missing = data.missingItems || []
  const stale = data.stalePending || []
  const sessions = data.expiredSessions || []
  const toggle = (setList, id) => v => setList(l => (v ? [...l, id] : l.filter(x => x !== id)))

  return (
    <div className={s.stack}>
      <Notice tone="info">这里列出需要你判断的数据。系统不会自动删除任何东西，所有清理都要你手动确认，删除后无法恢复。</Notice>

      <Card title="缺少商品明细的订单" subtitle="不知道顾客买了什么，没法发货。请联系顾客或到支付平台核对。这些是真实交易，不提供删除。"
        actions={<Badge tone={missing.length ? 'danger' : 'success'}>{missing.length}</Badge>} padded={false}>
        <DataTable rows={missing} empty={<EmptyState icon="check" title="没有这类订单" />}
          columns={[
            { key: 'n', header: '订单号', primary: true, render: o => <Link href={`/admin/orders/${encodeURIComponent(o.order_number)}`} prefetch={false} className={s.mono}>{o.order_number}</Link> },
            { key: 's', header: '状态', render: o => <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label || o.status}</Badge> },
            { key: 't', header: '金额', align: 'right', render: o => money(o.total_gbp) },
            { key: 'e', header: '顾客', render: o => o.customer_email },
            { key: 'd', header: '下单', align: 'right', render: o => date(o.created_at) },
          ]} />
      </Card>

      <Card title="长期未付款的订单" subtitle={`顾客点了结账但没付钱，超过 ${data.staleDays ?? 7} 天还是待付款。删掉后订单列表和客户统计更干净。`} padded={false}
        actions={selOrders.length > 0
          ? <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirm({ action: 'deleteOrders', ids: selOrders, title: '删除未付款订单', message: `将永久删除选中的 ${selOrders.length} 笔未付款订单和它们的商品明细，无法恢复。只有仍是"待付款"的订单会被删除。` })}>删除选中的 {selOrders.length} 笔</Button>
          : <Badge tone={stale.length ? 'warning' : 'success'}>{stale.length}</Badge>}>
        <DataTable rows={stale} empty={<EmptyState icon="check" title="没有长期未付款的订单" />}
          columns={[
            { key: 'sel', width: 40, header: <Checkbox checked={stale.length > 0 && selOrders.length === stale.length} onChange={v => setSelOrders(v ? stale.map(o => o.id) : [])} />,
              render: o => <Checkbox checked={selOrders.includes(o.id)} onChange={toggle(setSelOrders, o.id)} /> },
            { key: 'n', header: '订单号', primary: true, render: o => <span className={s.mono}>{o.order_number}</span> },
            { key: 't', header: '金额', align: 'right', render: o => money(o.total_gbp) },
            { key: 'e', header: '顾客', render: o => o.customer_email },
            { key: 'p', header: '支付方式', hideMobile: true, render: o => o.payment_method || '—' },
            { key: 'd', header: '已过去', align: 'right', render: o => `${daysSince(o.created_at)} 天` },
          ]} />
      </Card>

      {(sessions.length > 0 || data.expiredSessions) && (
        <Card title="过期的 PayPal 临时数据" subtitle="顾客用 PayPal 结账中途放弃留下的临时记录，已过期，可以放心删除。" padded={false}
          actions={selSessions.length > 0
            ? <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirm({ action: 'deleteSessions', ids: selSessions, title: '清理过期数据', message: `将删除选中的 ${selSessions.length} 条过期临时记录。` })}>删除选中的 {selSessions.length} 条</Button>
            : <Badge tone={sessions.length ? 'warning' : 'success'}>{sessions.length}</Badge>}>
          <DataTable rows={sessions} empty={<EmptyState icon="check" title="没有过期数据" />}
            columns={[
              { key: 'sel', width: 40, header: <Checkbox checked={sessions.length > 0 && selSessions.length === sessions.length} onChange={v => setSelSessions(v ? sessions.map(x => x.id) : [])} />,
                render: x => <Checkbox checked={selSessions.includes(x.id)} onChange={toggle(setSelSessions, x.id)} /> },
              { key: 'n', header: '关联单号', primary: true, render: x => <span className={s.mono}>{x.order_number || '—'}</span> },
              { key: 'c', header: '创建', render: x => date(x.created_at) },
              { key: 'e', header: '过期', align: 'right', render: x => date(x.expires_at) },
            ]} />
        </Card>
      )}

      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger confirmLabel="删除" loading={busy}
        onCancel={() => setConfirm(null)} onConfirm={run} />
    </div>
  )
}
