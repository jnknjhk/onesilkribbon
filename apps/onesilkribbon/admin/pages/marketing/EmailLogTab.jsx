'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { dateTime } from '../../lib/format'
import { useListRequest } from '../../lib/use-list-request'
import {
  Card, SearchInput, Select, DataTable, Pager, Badge, Button, EmptyState, Notice, styles as s,
} from '../../ui'

const KINDS = [
  { value: 'order_confirmation', label: '订单确认（给顾客）' },
  { value: 'owner_notification', label: '新订单通知（给你）' },
  { value: 'shipping', label: '发货通知' },
  { value: 'contact', label: '联系表单留言' },
  { value: 'contact_autoreply', label: '留言自动回复' },
  { value: 'marketing', label: '后台手动发送' },
]
const kindLabel = v => KINDS.find(k => k.value === v)?.label || v || '—'

export default function EmailLogTab({ get, set }) {
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
  const { data, loading, error, reload } = useListRequest(`/api/admin/emails?${params.toString()}`)

  return (
    <>
      {error && (
        <Notice tone="danger" style={{ marginBottom: 14 }}>
          邮件记录加载失败：{error} <Button size="sm" onClick={reload}>重试</Button>
        </Notice>
      )}
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
              ? <Link href={`/admin/orders/${encodeURIComponent(m.order_number)}`} className={s.mono}>{m.order_number}</Link> : '—') },
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
