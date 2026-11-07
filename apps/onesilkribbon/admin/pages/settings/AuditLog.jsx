'use client'
import { useListRequest } from '../../lib/use-list-request'
import { useUrlState } from '../../lib/url-state'
import { dateTime } from '../../lib/format'
import { Card, DataTable, Pager, Badge, EmptyState, Notice, styles as s } from '../../ui'

const ACTIONS = {
  'product.create':          { label: '新建商品', tone: 'success' },
  'product.update':          { label: '更新商品', tone: 'info' },
  'product.delete':          { label: '删除商品', tone: 'danger' },
  'customer.erase':          { label: '删除客户', tone: 'danger' },
  'order.refund':            { label: '退款',     tone: 'danger' },
  'order.ship':              { label: '发货',     tone: 'info' },
  'settings.update':         { label: '修改设置', tone: 'warning' },
  'maintenance.close_orders':{ label: '关闭未付款订单', tone: 'warning' },
  'maintenance.delete_sessions': { label: '清理临时数据', tone: 'danger' },
  'media.delete':            { label: '删除媒体', tone: 'danger' },
}

function detailText(detail) {
  if (!detail || typeof detail !== 'object') return '—'
  const text = JSON.stringify(detail)
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

export default function AuditLog() {
  const [get, set] = useUrlState({ page: '1' })
  const page = parseInt(get('page'), 10) || 1
  const { data, loading, error } = useListRequest(`/api/admin/audit-log?page=${page}`)

  if (error) return <Notice tone="danger">操作记录加载失败：{error}</Notice>
  if (data?.unavailable) {
    return (
      <Notice tone="info">
        审计表还没创建。请先执行 Supabase 迁移 `2026-11-08-admin-audit-log.sql`，之后的操作会开始记录。
      </Notice>
    )
  }

  return (
    <Card padded={false}>
      <DataTable
        loading={loading && !data}
        rows={data?.entries || []}
        rowKey="id"
        empty={<EmptyState icon="note" title="还没有操作记录" text="新建商品、退款、删除客户等敏感操作会记录在这里。" />}
        columns={[
          { key: 'time', header: '时间', render: r => <span className={s.muted}>{dateTime(r.created_at)}</span> },
          { key: 'actor', header: '操作人', render: r => r.actor_email },
          { key: 'action', header: '操作', render: r => (
            <Badge tone={ACTIONS[r.action]?.tone || 'neutral'}>{ACTIONS[r.action]?.label || r.action}</Badge>
          ) },
          { key: 'target', header: '对象', hideMobile: true, render: r => (
            <span className={s.muted}>{[r.target_type, r.target_id].filter(Boolean).join(' / ') || '—'}</span>
          ) },
          { key: 'detail', header: '详情', hideMobile: true, render: r => (
            <span className={s.muted} title={detailText(r.detail)}>{detailText(r.detail)}</span>
          ) },
        ]}
      />
      <Pager page={page} totalPages={data?.totalPages} total={data?.total} unit="条" onChange={p => set({ page: p })} />
    </Card>
  )
}
