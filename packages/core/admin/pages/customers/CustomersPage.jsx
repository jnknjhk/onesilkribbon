'use client'
// 客户：两个页签
//   · 客户   —— 下过单的人（按邮箱合并），点进去看他的全部订单、地址、是否订阅
//   · 订阅者 —— 邮件订阅名单，可以导出 CSV
// 原来的"订阅者"是单独一个菜单，现在并到客户里。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { money, date, ago } from '../../lib/format'
import { ORDER_STATUS } from '../../lib/status'
import { useUrlState } from '../../lib/url-state'
import {
  PageHeader, Card, Tabs, SearchInput, Select, Segmented, DataTable, Pager, Badge, Button, ButtonLink,
  EmptyState, Notice, Stat, SkeletonRows, useToast, styles as s,
} from '../../ui'

const PAGE_SIZE = 30
const DEFAULTS = { tab: 'customers', q: '', type: 'all', source: '', page: '1', email: '' }

export default function CustomersPage() {
  const [get, set] = useUrlState(DEFAULTS)
  const email = get('email')
  if (email) return <CustomerDetail email={email} onBack={() => set({ email: '' })} />

  const tab = get('tab')
  return (
    <div>
      <PageHeader title="客户" />
      <Tabs value={tab} onChange={v => set({ tab: v, q: '', page: 1, type: '', source: '' })}
        tabs={[{ key: 'customers', label: '客户' }, { key: 'subscribers', label: '订阅者' }]} />
      {tab === 'subscribers' ? <SubscriberList get={get} set={set} /> : <CustomerList get={get} set={set} />}
    </div>
  )
}

// 搜索框输入停顿 300ms 再写进网址
function useDebouncedQuery(get, set) {
  const q = get('q')
  const [value, setValue] = useState(q)
  useEffect(() => { setValue(q) }, [q])
  useEffect(() => {
    if (value === q) return
    const t = setTimeout(() => set({ q: value, page: 1 }), 300)
    return () => clearTimeout(t)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue]
}

// ── 客户列表 ──────────────────────────────────────────────────────────────────
function CustomerList({ get, set }) {
  const toast = useToast()
  const [customers, setCustomers] = useState(null)
  const [search, setSearch] = useDebouncedQuery(get, set)
  const q = get('q').toLowerCase()
  const type = get('type')
  const page = parseInt(get('page'), 10) || 1

  useEffect(() => {
    api('/api/admin/customers')
      .then(d => setCustomers(d.customers || []))
      .catch(e => { toast.error('客户加载失败：' + e.message); setCustomers([]) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => customers || [], [customers])
  const filtered = useMemo(() => list.filter(c => {
    if (type === 'registered' && !c.user_id) return false
    if (type === 'guest' && c.user_id) return false
    return !q || c.email.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)
  }), [list, q, type])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const registered = list.filter(c => c.user_id).length

  return (
    <>
      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索邮箱或姓名" style={{ flex: 1, minWidth: 220 }} />
        <Segmented value={type} onChange={v => set({ type: v, page: 1 })} options={[
          { value: 'all', label: `全部 ${list.length}` },
          { value: 'registered', label: `已注册 ${registered}` },
          { value: 'guest', label: `访客 ${list.length - registered}` },
        ]} />
      </div>
      <Card padded={false}>
        <DataTable
          loading={!customers}
          rows={rows}
          rowKey="email"
          onRowClick={c => set({ email: c.email }, { replace: false })}
          empty={<EmptyState icon="users" title={list.length ? '没有符合条件的客户' : '还没有客户'} text={list.length ? null : '有人下单后会出现在这里'} />}
          columns={[
            { key: 'who', header: '客户', primary: true, render: c => (
              <>
                <div className={s.cellMain}>{c.name || c.email}</div>
                {c.name && <div className={s.cellSub}>{c.email}</div>}
              </>
            ) },
            { key: 'type', header: '类型', render: c => c.user_id ? <Badge tone="brand">已注册</Badge> : <Badge>访客</Badge> },
            { key: 'loc', header: '位置', hideMobile: true, render: c => [c.city, c.country].filter(Boolean).join(', ') || '—' },
            { key: 'orders', header: '订单', align: 'right', render: c => <span className={s.num}>{c.orders}</span> },
            { key: 'spent', header: '累计消费', align: 'right', render: c => <span className={s.num}>{money(c.spent)}</span> },
            { key: 'last', header: '最近下单', align: 'right', render: c => <span className={s.muted} title={date(c.lastOrder)}>{ago(c.lastOrder)}</span> },
          ]}
        />
        {customers && <Pager page={page} totalPages={totalPages} total={filtered.length} unit="位客户" onChange={p => set({ page: p })} />}
      </Card>
    </>
  )
}

// ── 客户详情 ──────────────────────────────────────────────────────────────────
function CustomerDetail({ email, onBack }) {
  const router = useRouter()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null); setError('')
    api(`/api/admin/customers?email=${encodeURIComponent(email)}`).then(setData).catch(e => setError(e.message))
  }, [email])

  const back = { onClick: onBack, label: '客户列表' }
  if (error) return <div><PageHeader back={back} title={email} /><Notice tone="danger">{error}</Notice></div>
  if (!data) return <div><PageHeader back={back} title={email} /><Card><SkeletonRows rows={6} /></Card></div>

  const { customer: c, orders, profile, addresses, shippingAddresses, subscriber } = data
  const mailHref = `/admin/marketing?tab=email&to=${encodeURIComponent(c.email)}${c.name ? `&name=${encodeURIComponent(c.name)}` : ''}`

  async function copyEmail() {
    try { await navigator.clipboard.writeText(c.email); toast.success('邮箱已复制') } catch { toast.error('复制失败，请手动选择') }
  }

  return (
    <div>
      <PageHeader back={back} title={c.name || c.email}
        subtitle={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {c.user_id ? <Badge tone="brand">已注册</Badge> : <Badge>访客</Badge>}
          <span>{c.email}</span>
        </span>}
        actions={<>
          <Button icon="copy" onClick={copyEmail}>复制邮箱</Button>
          <ButtonLink href={mailHref} variant="primary" icon="mail">发邮件</ButtonLink>
        </>} />

      <div className={s.grid4} style={{ marginBottom: 16 }}>
        <Stat label="订单" value={c.orders} />
        <Stat label="累计消费" value={money(c.spent)} sub="已付款、已发货、已送达的订单" />
        <Stat label="第一次下单" value={date(c.firstOrder)} />
        <Stat label="最近下单" value={date(c.lastOrder)} sub={ago(c.lastOrder)} />
      </div>

      <div className={s.split}>
        <Card title="订单" padded={false}>
          <DataTable rows={orders} rowKey="order_number"
            onRowClick={o => router.push(`/admin/orders/${encodeURIComponent(o.order_number)}`)}
            empty={<EmptyState title="没有订单" />}
            columns={[
              { key: 'n', header: '订单号', primary: true, render: o => <span className={s.mono}>{o.order_number}</span> },
              { key: 'd', header: '日期', render: o => date(o.created_at) },
              { key: 's', header: '状态', render: o => <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label || o.status}</Badge> },
              { key: 't', header: '金额', align: 'right', render: o => <span className={s.num}>{money(o.total_gbp)}</span> },
            ]} />
        </Card>

        <div className={s.stack}>
          <Card title="资料">
            <dl className={s.kv}>
              <dt>姓名</dt><dd>{profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || c.name || '—' : c.name || '—'}</dd>
              <dt>邮箱</dt><dd>{c.email}</dd>
              <dt>电话</dt><dd>{c.phone || '—'}</dd>
              {profile && <><dt>注册时间</dt><dd>{date(profile.created_at)}</dd></>}
            </dl>
          </Card>
          <Card title="邮件订阅">
            {subscriber ? (
              <dl className={s.kv}>
                <dt>状态</dt><dd><SubscriberStatus sub={subscriber} /></dd>
                <dt>订阅时间</dt><dd>{date(subscriber.subscribed_at || subscriber.created_at)}</dd>
              </dl>
            ) : <span className={s.muted}>没有订阅</span>}
          </Card>
          <Card title="地址">
            {addresses.length === 0 && shippingAddresses.length === 0 && <span className={s.muted}>没有地址</span>}
            <div className={s.stack} style={{ fontSize: 14 }}>
              {addresses.map(a => (
                <div key={a.id}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span className={s.cellMain}>{[a.first_name, a.last_name].filter(Boolean).join(' ') || '账户地址'}</span>
                    {a.label && <span className={s.muted} style={{ fontSize: 13 }}>{a.label}</span>}
                    {a.is_default && <Badge tone="brand">默认</Badge>}
                  </div>
                  <div style={{ color: 'var(--text-2)' }}>{[a.line1, a.line2, a.city, a.postcode, a.country].filter(Boolean).join(', ')}</div>
                  {a.phone && <div className={s.cellSub}>{a.phone}</div>}
                </div>
              ))}
              {shippingAddresses.map(a => (
                <div key={a.line}>
                  <div className={s.cellMain} style={{ marginBottom: 2 }}>{a.name || '收货地址'}</div>
                  <div style={{ color: 'var(--text-2)' }}>{a.line}</div>
                  <div className={s.cellSub}>订单里用过 · 最近 {date(a.last_used)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SubscriberStatus({ sub }) {
  if (sub.status === 'unsubscribed') return <Badge>已退订</Badge>
  return sub.verified ? <Badge tone="success">已验证</Badge> : <Badge tone="warning">待验证</Badge>
}

// ── 订阅者 ────────────────────────────────────────────────────────────────────
function csvField(value) {
  const str = value == null ? '' : String(value)
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function SubscriberList({ get, set }) {
  const cfg = useAdminConfig()
  const toast = useToast()
  const [search, setSearch] = useDebouncedQuery(get, set)
  const q = get('q')
  const source = get('source')
  const page = parseInt(get('page'), 10) || 1
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const sourceLabel = useCallback(v => cfg.subscriberSources.find(x => x.value === v)?.label || v || '—', [cfg])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('search', q)
    if (source) params.set('source', source)
    api(`/api/admin/subscribers?${params}`)
      .then(setData)
      .catch(e => toast.error('订阅者加载失败：' + e.message))
      .finally(() => setLoading(false))
  }, [page, q, source]) // eslint-disable-line react-hooks/exhaustive-deps

  // 导出和旧版格式一致：Email, Source, Status, Subscribed At；带 BOM，Excel 打开不乱码
  async function exportCsv() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ all: '1' })
      if (q) params.set('search', q)
      if (source) params.set('source', source)
      const { subscribers = [] } = await api(`/api/admin/subscribers?${params}`)
      const lines = [['Email', 'Source', 'Status', 'Subscribed At'].map(csvField).join(',')]
      for (const r of subscribers) {
        lines.push([r.email, sourceLabel(r.source), r.verified ? 'Verified' : 'Pending', date(r.subscribed_at || r.created_at)].map(csvField).join(','))
      }
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${subscribers.length} 位订阅者`)
    } catch (e) { toast.error('导出失败：' + e.message) }
    setExporting(false)
  }

  return (
    <>
      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索邮箱" style={{ flex: 1, minWidth: 220 }} />
        <Select value={source} onChange={e => set({ source: e.target.value, page: 1 })} style={{ width: 160 }}>
          <option value="">全部来源</option>
          {cfg.subscriberSources.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
        </Select>
        <Button icon="download" loading={exporting} onClick={exportCsv}>导出 CSV</Button>
      </div>
      <Card padded={false}>
        <DataTable
          loading={loading && !data}
          rows={data?.subscribers || []}
          empty={<EmptyState icon="mail" title={q || source ? '没有匹配的订阅者' : '还没有订阅者'} />}
          columns={[
            { key: 'email', header: '邮箱', primary: true, render: r => <span className={s.cellMain}>{r.email}</span> },
            { key: 'source', header: '来源', render: r => sourceLabel(r.source) },
            { key: 'status', header: '状态', render: r => <SubscriberStatus sub={r} /> },
            { key: 'date', header: '订阅时间', align: 'right', render: r => <span className={s.muted}>{date(r.subscribed_at || r.created_at)}</span> },
          ]}
        />
        {data && <Pager page={page} totalPages={data.totalPages} total={data.total} unit="位订阅者" onChange={p => set({ page: p })} />}
      </Card>
    </>
  )
}
