'use client'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { money, date } from '../../lib/format'
import { useListRequest } from '../../lib/use-list-request'
import {
  Card, DataTable, Pager, Badge, Button, Field, Input, Textarea, Segmented, Checkbox, Modal,
  ConfirmDialog, EmptyState, Notice, Stat, useToast, styles as s,
} from '../../ui'

const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_gbp: '', max_uses: '', expires_at: '', active: true }
const isExpired = c => c.expires_at && new Date(c.expires_at) < new Date()
const fmtDiscount = c => (c.discount_type === 'percentage' ? `${Number(c.discount_value)}% off` : `减 ${money(c.discount_value)}`)

function couponState(c) {
  if (!c.active) return { tone: 'neutral', label: '已停用' }
  if (isExpired(c)) return { tone: 'warning', label: '已过期' }
  if (c.max_uses && (c.uses_count || 0) >= c.max_uses) return { tone: 'warning', label: '已用完' }
  return { tone: 'success', label: '有效' }
}

export default function CouponsTab({ get, set }) {
  const toast = useToast()
  const page = parseInt(get('page'), 10) || 1
  const { data, loading, error, reload } = useListRequest(`/api/admin/coupons?page=${page}`)
  const [editing, setEditing] = useState(null) // null | 'new' | coupon
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data && page > data.totalPages) set({ page: data.totalPages })
  }, [data, page, set])

  async function toggle(c) {
    try {
      await api('/api/admin/coupons', { method: 'PATCH', body: { id: c.id, active: !c.active } })
      toast.success(c.active ? `${c.code} 已停用` : `${c.code} 已启用`)
      reload()
    } catch (e) { toast.error(e.message) }
  }

  async function remove() {
    setBusy(true)
    try {
      await api('/api/admin/coupons', { method: 'DELETE', body: { id: confirm.id } })
      toast.success(`${confirm.code} 已删除`)
      setConfirm(null); reload()
    } catch (e) { toast.error('删除失败：' + e.message) }
    setBusy(false)
  }

  const list = data?.coupons || []
  const summary = data?.summary || {}
  return (
    <>
      <div className={s.grid3} style={{ marginBottom: 16 }}>
        <Stat label="优惠码" value={summary.total ?? '—'} />
        <Stat label="当前有效" value={summary.valid ?? '—'} />
        <Stat label="累计使用" value={summary.uses ?? '—'} sub="次" />
      </div>
      {error && (
        <Notice tone="danger" style={{ marginBottom: 14 }}>
          优惠码加载失败：{error} <Button size="sm" onClick={reload}>重试</Button>
        </Notice>
      )}
      <Card title="优惠码" padded={false} actions={<Button variant="primary" size="sm" icon="plus" onClick={() => setEditing('new')}>新建优惠码</Button>}>
        <DataTable loading={loading && !data} rows={list} onRowClick={c => setEditing(c)}
          empty={<EmptyState icon="ticket" title="还没有优惠码" />}
          columns={[
            { key: 'code', header: '优惠码', primary: true, render: c => (
              <>
                <div className={s.cellMain}><span className={s.mono}>{c.code}</span></div>
                {c.description && <div className={s.cellSub}>{c.description}</div>}
              </>
            ) },
            { key: 'd', header: '折扣', render: fmtDiscount },
            { key: 'min', header: '最低消费', hideMobile: true, render: c => (Number(c.min_order_gbp) > 0 ? money(c.min_order_gbp) : '不限') },
            { key: 'uses', header: '已使用', align: 'right', render: c => <span className={s.num}>{c.uses_count || 0}{c.max_uses ? ` / ${c.max_uses}` : ''}</span> },
            { key: 'exp', header: '有效期至', hideMobile: true, render: c => (c.expires_at ? date(c.expires_at) : '长期') },
            { key: 'st', header: '状态', render: c => { const st = couponState(c); return <Badge tone={st.tone}>{st.label}</Badge> } },
            { key: 'act', header: '', align: 'right', render: c => (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Button size="sm" variant="ghost" onClick={() => toggle(c)}>{c.active ? '停用' : '启用'}</Button>
                <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="删除" onClick={() => setConfirm(c)} />
              </span>
            ) },
          ]} />
        {data && <Pager page={page} totalPages={data.totalPages} total={data.total} unit="个" onChange={p => set({ page: p })} />}
      </Card>
      {editing && <CouponForm coupon={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      <ConfirmDialog open={!!confirm} title="删除优惠码" danger confirmLabel="删除" loading={busy}
        message={`确定删除 ${confirm?.code} 吗？已经用过它的订单不受影响；如果只是暂时不想让人用，可以"停用"。`}
        onCancel={() => setConfirm(null)} onConfirm={remove} />
    </>
  )
}

function CouponForm({ coupon, onClose, onSaved }) {
  const toast = useToast()
  const isNew = coupon === 'new'
  const [form, setForm] = useState(() => (isNew ? EMPTY : {
    ...coupon,
    description: coupon.description || '',
    expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
    max_uses: coupon.max_uses || '',
    min_order_gbp: coupon.min_order_gbp || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const setF = patch => setForm(p => ({ ...p, ...patch }))

  async function save() {
    setError('')
    if (!form.code.trim() || !form.discount_value) { setError('请填写优惠码和折扣'); return }
    const value = parseFloat(form.discount_value)
    if (!(value > 0)) { setError('折扣要大于 0'); return }
    if (form.discount_type === 'percentage' && value > 100) { setError('百分比折扣不能超过 100%'); return }
    setSaving(true)
    // 和旧版提交的字段完全一样
    const payload = {
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: value,
      min_order_gbp: parseFloat(form.min_order_gbp) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at || null,
      active: form.active,
    }
    try {
      await api('/api/admin/coupons', { method: 'POST', body: isNew ? { action: 'create', payload } : { action: 'update', id: coupon.id, payload } })
      toast.success(isNew ? `${payload.code} 已创建` : `${payload.code} 已更新`)
      onSaved()
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <Modal open title={isNew ? '新建优惠码' : `编辑 ${coupon.code}`} onClose={onClose} width={520}
      footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" loading={saving} onClick={save}>保存</Button></>}>
      <div className={s.stack}>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className={s.grid2}>
          <Field label="优惠码" required hint="顾客结账时输入，自动转成大写">
            <Input value={form.code} className={s.mono} placeholder="SUMMER20" onChange={e => setF({ code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="说明（只有你能看到）">
            <Input value={form.description} placeholder="夏季活动" onChange={e => setF({ description: e.target.value })} />
          </Field>
        </div>
        <Field label="折扣方式" group>
          <Segmented value={form.discount_type} onChange={v => setF({ discount_type: v })}
            options={[{ value: 'percentage', label: '按百分比' }, { value: 'fixed', label: '减固定金额' }]} />
        </Field>
        <div className={s.grid2}>
          <Field label={form.discount_type === 'percentage' ? '折扣 (%)' : '减免金额 (£)'} required>
            <Input type="number" step="0.01" min="0" value={form.discount_value} onChange={e => setF({ discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? '20' : '5.00'} />
          </Field>
          <Field label="最低消费 (£)" hint="不填 = 不限">
            <Input type="number" step="0.01" min="0" value={form.min_order_gbp} onChange={e => setF({ min_order_gbp: e.target.value })} />
          </Field>
          <Field label="最多使用次数" hint="不填 = 不限">
            <Input type="number" min="1" value={form.max_uses} onChange={e => setF({ max_uses: e.target.value })} />
          </Field>
          <Field label="有效期至" hint="不填 = 长期有效">
            <Input type="date" value={form.expires_at} onChange={e => setF({ expires_at: e.target.value })} />
          </Field>
        </div>
        <Checkbox checked={form.active} onChange={v => setF({ active: v })}>启用（顾客现在就能用）</Checkbox>
        {!isNew && <div className={s.fieldHint}>已经使用 {coupon.uses_count || 0} 次</div>}
      </div>
    </Modal>
  )
}
