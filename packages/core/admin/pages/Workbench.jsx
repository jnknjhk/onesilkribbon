'use client'
// 工作台：打开后台第一眼就知道今天要做什么，而不是一排"全部时间"的统计数字。
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminConfig } from '../config'
import { api } from '../lib/api'
import { money, ago } from '../lib/format'
import { ORDER_STATUS } from '../lib/status'
import { PageHeader, Card, Badge, DataTable, EmptyState, Icon, Notice, Stat, styles as s, cx } from '../ui'

function Todo({ href, icon, tone, count, label, sub }) {
  const colors = {
    warning: ['var(--warning-soft)', 'var(--warning)'],
    danger: ['var(--danger-soft)', 'var(--danger)'],
    info: ['var(--info-soft)', 'var(--info)'],
    neutral: ['#EFEDEA', 'var(--text-2)'],
  }[tone]
  const done = !count
  return (
    <Link href={href} className={cx(s.todo, done && s.todoDone)}>
      <span className={s.todoIcon} style={{ background: done ? '#EFEDEA' : colors[0], color: done ? 'var(--text-3)' : colors[1] }}>
        <Icon name={done ? 'check' : icon} size={20} />
      </span>
      <span style={{ minWidth: 0 }}>
        <div className={cx(s.todoCount, s.num)}>{count ?? '—'}</div>
        <div className={s.todoLabel}>{label}</div>
        {sub && <div className={s.statSub}>{sub}</div>}
      </span>
      <Icon name="chevronRight" size={16} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />
    </Link>
  )
}

export default function Workbench() {
  const cfg = useAdminConfig()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/admin/dashboard').then(setData).catch(e => setError(e.message))
  }, [])

  const t = data?.todo
  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className={s.stack}>
      <PageHeader title={greeting} subtitle={new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} />

      {error && <Notice tone="danger">工作台数据加载失败：{error}</Notice>}

      <div className={s.grid4}>
        <Todo href="/admin/orders?tab=to_ship" icon="truck" tone="warning" count={t?.toShip}
          label="待发货" sub={t?.toShipOverdue ? `${t.toShipOverdue} 单已等超过 2 天` : t ? '没有积压' : null} />
        <Todo href="/admin/products?view=stock&filter=low" icon="layers" tone="danger" count={t?.lowStock}
          label="库存预警" sub={t ? `库存 ≤ ${t.lowStockThreshold} 的在售 SKU` : null} />
        {cfg.features.emailLog && t?.failedEmails !== null && (
          <Todo href="/admin/marketing?tab=log&status=failed" icon="mail" tone="danger" count={t?.failedEmails}
            label="发送失败的邮件" sub="近 7 天" />
        )}
        <Todo href={cfg.features.maintenance ? '/admin/settings?tab=maintenance' : '/admin/orders?tab=all'} icon="alert" tone="info" count={t?.needsReview}
          label="需要核对的订单" sub="已付款但没有商品明细" />
      </div>

      <div className={s.grid3}>
        <Stat label="今天" value={data ? money(data.sales.today.revenue) : '…'} sub={data ? `${data.sales.today.orders} 单` : null} />
        <Stat label="近 7 天" value={data ? money(data.sales.d7.revenue) : '…'} sub={data ? `${data.sales.d7.orders} 单` : null} />
        <Stat label="近 30 天" value={data ? money(data.sales.d30.revenue) : '…'} sub={data ? `${data.sales.d30.orders} 单 · 累计 ${money(data.sales.all.revenue)}` : null} />
      </div>

      <Card title="最近订单" padded={false}
        actions={<Link href="/admin/orders?tab=all" className={cx(s.btn, s.btn_ghost, s.btnSm)}>全部订单<Icon name="chevronRight" size={15} /></Link>}>
        <DataTable
          loading={!data && !error}
          rows={data?.recent || []}
          rowKey="id"
          onRowClick={o => router.push(`/admin/orders/${encodeURIComponent(o.order_number)}`)}
          empty={<EmptyState icon="package" title="还没有订单" />}
          columns={[
            { key: 'order_number', header: '订单号', primary: true, render: o => (
              <><span className={s.mono}>{o.order_number}</span><div className={s.cellSub}>{o.shipping_name || o.customer_email}</div></>
            ) },
            { key: 'status', header: '状态', render: o => <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label || o.status}</Badge> },
            { key: 'total', header: '金额', align: 'right', render: o => <span className={s.num}>{money(o.total_gbp)}</span> },
            { key: 'created_at', header: '下单', align: 'right', render: o => <span className={s.muted}>{ago(o.created_at)}</span> },
          ]}
        />
      </Card>
    </div>
  )
}
