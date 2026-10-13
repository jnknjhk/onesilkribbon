'use client'
// 营销：优惠码、给顾客发邮件、邮件记录。
// 运费设置原来放在这里，现在挪到"设置"。
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { useApi } from '../../lib/use-api'
import { money, date, dateTime } from '../../lib/format'
import { useUrlState } from '../../lib/url-state'
import {
  PageHeader, Card, Tabs, SearchInput, Select, DataTable, Pager, Badge, Button, Field, Input, Textarea,
  Segmented, Checkbox, Modal, ConfirmDialog, EmptyState, Notice, Stat, useToast, styles as s,
} from '../../ui'

const DEFAULTS = { tab: 'coupons', q: '', kind: '', status: '', page: '1', order: '', to: '', name: '' }

export default function MarketingPage() {
  const cfg = useAdminConfig()
  const [get, set] = useUrlState(DEFAULTS)
  const tabs = [
    { key: 'coupons', label: '优惠码' },
    { key: 'email', label: '发邮件' },
    ...(cfg.features.emailLog ? [{ key: 'log', label: '邮件记录' }] : []),
  ]
  const tab = tabs.some(t => t.key === get('tab')) ? get('tab') : 'coupons'
  return (
    <div>
      <PageHeader title="营销" />
      <Tabs value={tab} onChange={v => set({ tab: v, q: '', kind: '', status: '', page: 1, order: '', to: '', name: '' })} tabs={tabs} />
      {tab === 'coupons' && <Coupons />}
      {tab === 'email' && <Compose get={get} set={set} />}
      {tab === 'log' && <EmailLog get={get} set={set} />}
    </div>
  )
}

// ── 优惠码 ────────────────────────────────────────────────────────────────────
const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_gbp: '', max_uses: '', expires_at: '', active: true }
const isExpired = c => c.expires_at && new Date(c.expires_at) < new Date()
const fmtDiscount = c => (c.discount_type === 'percentage' ? `${Number(c.discount_value)}% off` : `减 ${money(c.discount_value)}`)

function couponState(c) {
  if (!c.active) return { tone: 'neutral', label: '已停用' }
  if (isExpired(c)) return { tone: 'warning', label: '已过期' }
  if (c.max_uses && (c.uses_count || 0) >= c.max_uses) return { tone: 'warning', label: '已用完' }
  return { tone: 'success', label: '有效' }
}

function Coupons() {
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | coupon
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  // 不用缓存：编辑优惠码时表单用的是列表里这一行的数据，保存会写回全部字段，必须是最新的
  const { data, error, reload: load } = useApi('/api/admin/coupons', { cache: false })
  useEffect(() => { if (error) toast.error('优惠码加载失败：' + error) }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  const coupons = data ? data.coupons || [] : (error ? [] : null)

  async function toggle(c) {
    try {
      await api('/api/admin/coupons', { method: 'PATCH', body: { id: c.id, active: !c.active } })
      toast.success(c.active ? `${c.code} 已停用` : `${c.code} 已启用`)
      load()
    } catch (e) { toast.error(e.message) }
  }

  async function remove() {
    setBusy(true)
    try {
      await api('/api/admin/coupons', { method: 'DELETE', body: { id: confirm.id } })
      toast.success(`${confirm.code} 已删除`)
      setConfirm(null); load()
    } catch (e) { toast.error('删除失败：' + e.message) }
    setBusy(false)
  }

  const list = coupons || []
  return (
    <>
      <div className={s.grid3} style={{ marginBottom: 16 }}>
        <Stat label="优惠码" value={list.length} />
        <Stat label="当前有效" value={list.filter(c => couponState(c).label === '有效').length} />
        <Stat label="累计使用" value={list.reduce((n, c) => n + (c.uses_count || 0), 0)} sub="次" />
      </div>
      <Card title="优惠码" padded={false} actions={<Button variant="primary" size="sm" icon="plus" onClick={() => setEditing('new')}>新建优惠码</Button>}>
        <DataTable loading={!coupons} rows={list} onRowClick={c => setEditing(c)}
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
      </Card>
      {editing && <CouponForm coupon={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
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

// ── 发邮件 ────────────────────────────────────────────────────────────────────
// 从订单页点"给顾客发邮件"会带上 ?order=订单号，从客户页带 ?to=邮箱&name=姓名，
// 选模板时 {姓名}{订单号}{快递单号}{快递公司} 自动填好；发送前还剩 {…} 就拦下来
function Compose({ get, set }) {
  const cfg = useAdminConfig()
  const toast = useToast()
  const orderNumber = get('order')
  const [ctx, setCtx] = useState({ to: get('to'), name: get('name').split(' ')[0], order: null })
  const [to, setTo] = useState(get('to'))
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [template, setTemplate] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // 收件人输入框的邮箱提示：和客户列表共用同一份缓存，看过客户页就不用再等
  const { data: customerData } = useApi('/api/admin/customers')
  const customers = useMemo(() => customerData?.customers || [], [customerData])

  useEffect(() => {
    if (!orderNumber) return
    api(`/api/admin/orders?number=${encodeURIComponent(orderNumber)}`)
      .then(d => {
        const o = d.order
        setCtx({ to: o.customer_email, name: (o.shipping_name || '').split(' ')[0], order: o })
        setTo(o.customer_email)
      })
      .catch(e => toast.error('读取订单失败：' + e.message))
  }, [orderNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  const fill = useCallback(text => {
    const o = ctx.order
    const name = ctx.name || (to && customers.find(c => c.email === to)?.name?.split(' ')[0]) || ''
    const values = {
      '姓名': name,
      '订单号': o?.order_number || '',
      '快递单号': o?.tracking_number || '',
      '快递公司': o?.tracking_carrier || '',
    }
    return text.replace(/\{([^}]+)\}/g, (m, k) => (values[k] ? values[k] : m))
  }, [ctx, to, customers])

  function applyTemplate(t) {
    setTemplate(t.label)
    setSubject(fill(t.subject))
    setBody(fill(t.body))
    setError('')
  }

  const leftover = useMemo(() => [...new Set(`${subject}\n${body}`.match(/\{[^}]+\}/g) || [])], [subject, body])

  async function send() {
    setError('')
    if (!to.trim() || !subject.trim() || !body.trim()) { setError('请填写收件人、主题和正文'); return }
    if (leftover.length) { setError(`还有没替换的内容：${leftover.join(' ')}，请改好再发`); return }
    setSending(true)
    try {
      await api('/api/admin/send-email', { method: 'POST', body: { to: to.trim(), subject, body } })
      toast.success(`邮件已发送给 ${to.trim()}`)
      setSubject(''); setBody(''); setTemplate('')
      if (orderNumber || get('to')) set({ order: '', to: '', name: '' })
    } catch (e) { setError('发送失败：' + e.message) }
    setSending(false)
  }

  return (
    <div className={s.split}>
      <Card title="写邮件">
        <div className={s.stack}>
          {ctx.order && (
            <Notice tone="info">
              关于订单 <Link href={`/admin/orders/${encodeURIComponent(ctx.order.order_number)}`} className={s.mono}>{ctx.order.order_number}</Link>，选模板时会自动填好姓名和订单号。
            </Notice>
          )}
          <Field label="收件人" required>
            <Input type="email" list="osr-customer-emails" value={to} placeholder="customer@example.com" onChange={e => setTo(e.target.value)} />
            <datalist id="osr-customer-emails">
              {customers.slice(0, 500).map(c => <option key={c.email} value={c.email}>{c.name || ''}</option>)}
            </datalist>
          </Field>
          <Field label="主题" required>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </Field>
          <Field label="正文" required hint={`邮件会套上 ${cfg.brand} 的信头信尾，并抄送一份到 ${cfg.ownerEmail}`}>
            <Textarea rows={14} value={body} onChange={e => setBody(e.target.value)} />
          </Field>
          {leftover.length > 0 && <Notice tone="warning">把 {leftover.join(' ')} 换成实际内容后才能发送</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <div><Button variant="primary" icon="send" loading={sending} onClick={send}>发送</Button></div>
        </div>
      </Card>
      <Card title="模板" subtitle="点一下套用，可以接着修改">
        <div className={s.stack} style={{ gap: 8 }}>
          {cfg.emailTemplates.map(t => (
            <Button key={t.label} block variant={template === t.label ? 'primary' : 'secondary'} onClick={() => applyTemplate(t)}>{t.label}</Button>
          ))}
          <Button block variant="ghost" onClick={() => { setTemplate(''); setSubject(''); setBody('') }}>清空</Button>
        </div>
      </Card>
    </div>
  )
}

// ── 邮件记录 ──────────────────────────────────────────────────────────────────
const KINDS = [
  { value: 'order_confirmation', label: '订单确认（给顾客）' },
  { value: 'owner_notification', label: '新订单通知（给你）' },
  { value: 'shipping', label: '发货通知' },
  { value: 'contact', label: '联系表单留言' },
  { value: 'contact_autoreply', label: '留言自动回复' },
  { value: 'marketing', label: '后台手动发送' },
]
const kindLabel = v => KINDS.find(k => k.value === v)?.label || v || '—'

function EmailLog({ get, set }) {
  const toast = useToast()
  const q = get('q'), kind = get('kind'), status = get('status')
  const page = parseInt(get('page'), 10) || 1
  const [search, setSearch] = useState(q)
  useEffect(() => { setSearch(q) }, [q])
  useEffect(() => {
    if (search === q) return
    const t = setTimeout(() => set({ q: search, page: 1 }), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set('search', q)
  if (kind) params.set('kind', kind)
  if (status) params.set('status', status)
  const { data, error, loading } = useApi(`/api/admin/emails?${params}`)
  useEffect(() => { if (error) toast.error('邮件记录加载失败：' + error) }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {data?.notReady && <Notice tone="warning" style={{ marginBottom: 14 }}>{data.notReady}</Notice>}
      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索收件人、主题或订单号" style={{ flex: 1, minWidth: 220 }} />
        <Select value={kind} onChange={e => set({ kind: e.target.value, page: 1 })} style={{ width: 190 }}>
          <option value="">全部类型</option>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </Select>
        <Select value={status} onChange={e => set({ status: e.target.value, page: 1 })} style={{ width: 130 }}>
          <option value="">全部状态</option>
          <option value="sent">已发送</option>
          <option value="failed">发送失败</option>
        </Select>
      </div>
      <Card padded={false}>
        <DataTable loading={loading && !data} rows={data?.emails || []}
          empty={<EmptyState icon="mail" title={q || kind || status ? '没有符合条件的记录' : '还没有邮件记录'} />}
          columns={[
            { key: 'sub', header: '邮件', primary: true, render: m => (
              <>
                <div className={s.cellMain}>{m.subject || '（无主题）'}</div>
                <div className={s.cellSub}>{m.to_email}</div>
              </>
            ) },
            { key: 'kind', header: '类型', render: m => kindLabel(m.kind) },
            { key: 'order', header: '订单', hideMobile: true, render: m => (m.order_number
              ? <Link href={`/admin/orders/${encodeURIComponent(m.order_number)}`} prefetch={false} className={s.mono}>{m.order_number}</Link> : '—') },
            { key: 'st', header: '状态', render: m => (m.status === 'failed'
              ? <span title={m.error || ''}><Badge tone="danger">发送失败</Badge>{m.error && <div className={s.cellSub} style={{ maxWidth: 220 }}>{m.error}</div>}</span>
              : <Badge tone="success">已发送</Badge>) },
            { key: 't', header: '时间', align: 'right', render: m => <span className={s.muted}>{dateTime(m.created_at)}</span> },
          ]} />
        {data && <Pager page={page} totalPages={data.totalPages} total={data.total} unit="封" onChange={p => set({ page: p })} />}
      </Card>
    </>
  )
}
