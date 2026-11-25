'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../lib/api'
import { money, date } from '../../lib/format'
import { Card, Button, EmptyState, Notice, SkeletonRows, styles as s } from '../../ui'

const ROW = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center',
  justifyContent: 'space-between', gap: 12, padding: '12px 0',
  borderBottom: '1px solid var(--border)',
}

export default function PaymentRecovery() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)

  async function load() {
    setData(await api('/api/admin/payment-recovery', { cache: 'no-store' }))
  }
  useEffect(() => { load().catch(err => { setFailed(true); setMessage(err.message) }) }, [])

  async function refresh() {
    setRefreshing(true); setMessage(''); setFailed(false)
    try { await load() }
    catch (err) { setFailed(true); setMessage(err.message) }
    finally { setRefreshing(false) }
  }

  async function recover(orderNumber) {
    setBusy(true); setFailed(false); setMessage('正在核对付款记录…')
    try {
      const result = await api('/api/admin/payment-recovery', { method: 'POST', body: { orderNumber } })
      setMessage((result.pending ? '付款链接仍有效，库存预留已保留：' : '处理完成：') + orderNumber)
      await load()
    } catch (err) { setFailed(true); setMessage(err.message) }
    finally { setBusy(false) }
  }

  async function retryRefund(row) {
    setBusy(true); setFailed(false); setMessage('正在处理退款…')
    try {
      const result = await api('/api/admin/refund', {
        method: 'POST',
        body: {
          orderId: row.order_id,
          reason: row.reason || '后台重试退款',
          manual: !!row.manual,
          restock: !!row.restock,
        },
      })
      if (result?.success === false) {
        setFailed(true)
        setMessage(result.error || '退款尚未完成，请稍后重试')
      } else {
        setMessage('退款处理完成：' + (row.orders?.order_number || row.order_id))
      }
      await load()
    } catch (err) {
      setFailed(true)
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const groups = [
    ['待恢复付款', data?.receipts],
    ['待发送通知', data?.notifications],
    ['PayPal 待核对（可能尚未付款）', data?.pendingPayPal],
    ['Stripe 待核对（含链接创建异常）', data?.pendingStripe],
  ]
  const pendingRefunds = data?.pendingRefunds || []
  const unprocessedRefunds = data?.unprocessedRefunds || []
  const refundedWithoutRecord = data?.refundedWithoutRecord || []
  const disputes = data?.disputes || []

  return <div className="payment-recovery">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
      <p>核对已有付款并补齐订单、库存和通知；不会发起新的扣款。</p>
      <Button icon="refresh" loading={refreshing} disabled={busy} onClick={refresh}>刷新记录</Button>
    </div>
    <Notice>待处理类每组最多显示最早的 100 条。暂无记录表示当前列表没有待处理项，不代表已经核对所有历史付款。</Notice>
    {message && <div role="status" style={{ marginTop: 16 }}><Notice tone={failed ? 'danger' : 'info'}>{message}</Notice></div>}

    {groups.map(([title, rows]) => <Card key={title} title={title}
      subtitle={rows ? `${rows.length} 条记录` : '正在读取…'} style={{ marginTop: 20 }}>
      {!data && !message && <SkeletonRows rows={2} />}
      {rows?.length === 0 && <EmptyState icon="check" title="暂无待处理记录" text="无需操作，有新记录时可在这里核对。" />}
      {rows?.map(row => <div key={row.payment_id || row.order_number} style={ROW}>
        <Link className={s.mono} style={{ overflowWrap: 'anywhere', minWidth: 0 }} href={`/admin/orders/${encodeURIComponent(row.order_number)}`}>{row.order_number}</Link>
        <Button disabled={busy || refreshing} onClick={() => recover(row.order_number)}>核对并恢复</Button>
      </div>)}
    </Card>)}

    <Card title="待处理退款" subtitle="后台发起但还没完成的退款；自动退款可以重试，手动退款可以补记" style={{ marginTop: 20 }}>
      {!data && !message && <SkeletonRows rows={2} />}
      {data && pendingRefunds.length === 0 && <EmptyState icon="check" title="没有待处理退款" />}
      {pendingRefunds.map(row => <div key={row.order_id} style={ROW}>
        <div style={{ minWidth: 0 }}>
          {row.orders?.order_number
            ? <Link className={s.mono} href={`/admin/orders/${encodeURIComponent(row.orders.order_number)}`}>{row.orders.order_number}</Link>
            : <span className={s.mono}>{row.order_id}</span>}
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            {row.manual ? '手动退款' : '自动退款'} · {row.provider_status || '处理中'}
            {row.orders?.total_gbp != null && ` · ${money(row.orders.total_gbp)}`}
            {` · ${date(row.created_at)}`}
          </div>
          {row.reason && <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{row.reason}</div>}
        </div>
        <Button disabled={busy || refreshing} onClick={() => retryRefund(row)}>
          {row.manual ? '补记退款' : '重试退款'}
        </Button>
      </div>)}
    </Card>

    <Card title="支付平台退款待入账" subtitle="支付平台已经退款，本地还没确认处理；请先到支付平台核对" style={{ marginTop: 20 }}>
      {!data && !message && <SkeletonRows rows={2} />}
      {data && unprocessedRefunds.length === 0 && <EmptyState icon="check" title="没有待入账的退款" />}
      {unprocessedRefunds.map(row => <div key={`${row.provider}:${row.refund_id}`} style={ROW}>
        <div style={{ minWidth: 0 }}>
          <Link className={s.mono} href={`/admin/orders/${encodeURIComponent(row.order_number)}`}>{row.order_number}</Link>
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            {row.provider} · {money((Number(row.amount_pence) || 0) / 100)} {row.currency}
            {row.full_refund ? ' · 全额' : ' · 部分'} · {date(row.created_at)}
          </div>
        </div>
      </div>)}
    </Card>

    <Card title="已退款但无退款记录" subtitle="订单状态是已退款，但没有对应的退款记录；建议到支付平台核对" style={{ marginTop: 20 }}>
      {!data && !message && <SkeletonRows rows={2} />}
      {data && refundedWithoutRecord.length === 0 && <EmptyState icon="check" title="退款记录完整" />}
      {refundedWithoutRecord.map(row => <div key={row.id} style={ROW}>
        <div style={{ minWidth: 0 }}>
          <Link className={s.mono} href={`/admin/orders/${encodeURIComponent(row.order_number)}`}>{row.order_number}</Link>
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            {money(row.total_gbp)} · {row.payment_method || '未知支付方式'}
            {row.refund_reason ? ` · ${row.refund_reason}` : ''} · {date(row.created_at)}
          </div>
        </div>
      </div>)}
    </Card>

    <Card title="支付争议 / 拒付" subtitle="支付平台已发起争议；资金可能已被划走，请到支付平台提交证据" style={{ marginTop: 20 }}>
      {!data && !message && <SkeletonRows rows={2} />}
      {data && disputes.length === 0 && <EmptyState icon="check" title="没有支付争议" />}
      {disputes.map(row => <div key={`${row.provider}:${row.dispute_id}`} style={ROW}>
        <div style={{ minWidth: 0 }}>
          {row.order_number
            ? <Link className={s.mono} href={`/admin/orders/${encodeURIComponent(row.order_number)}`}>{row.order_number}</Link>
            : <span className={s.mono}>{row.dispute_id}</span>}
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            {row.provider} · {row.status}
            {row.amount_pence != null && ` · ${money(Number(row.amount_pence) / 100)} ${row.currency || ''}`}
            {row.evidence_due_by && ` · 举证截止 ${date(row.evidence_due_by)}`}
            {row.resolved_at && ` · 已结案 ${date(row.resolved_at)}`}
          </div>
          {row.reason && <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{row.reason}</div>}
        </div>
      </div>)}
    </Card>

    <style jsx global>{`
      .payment-recovery h1, .payment-recovery h2 { font-family: inherit; }
    `}</style>
  </div>
}
