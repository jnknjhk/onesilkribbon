'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader, Card, Button, EmptyState, Notice, SkeletonRows, styles as s } from '@osr/core/admin/ui/index'

export default function PaymentRecovery({ embedded = false }) {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  async function load() {
    const response = await fetch('/api/admin/payment-recovery', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '读取失败')
    setData(result)
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
      const response = await fetch('/api/admin/payment-recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '恢复失败，资料已保留')
      setMessage((result.pending ? '付款链接仍有效，库存预留已保留：' : '处理完成：') + orderNumber)
      await load()
    } catch (err) { setFailed(true); setMessage(err.message) }
    finally { setBusy(false) }
  }
  const groups = [['待恢复付款', data?.receipts], ['待发送通知', data?.notifications], ['PayPal 待核对（可能尚未付款）', data?.pendingPayPal], ['Stripe 待核对（含链接创建异常）', data?.pendingStripe]]
  return <div className="payment-recovery">
    {embedded ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
      <p>核对已有付款并补齐订单、库存和通知；不会发起新的扣款。</p>
      <Button icon="refresh" loading={refreshing} disabled={busy} onClick={refresh}>刷新记录</Button>
    </div> : <PageHeader title="付款恢复" subtitle="核对已有付款并补齐订单、库存和通知；不会发起新的扣款。"
      actions={<Button icon="refresh" loading={refreshing} disabled={busy} onClick={refresh}>刷新记录</Button>} />}
    <Notice>每组最多显示最早的 100 条。暂无记录表示当前列表没有待处理项，不代表已经核对所有历史付款。</Notice>
    {message && <div role="status" style={{ marginTop: 16 }}><Notice tone={failed ? 'danger' : 'info'}>{message}</Notice></div>}
    {groups.map(([title, rows]) => <Card key={title} title={title}
      subtitle={rows ? `${rows.length} 条记录` : '正在读取…'} style={{ marginTop: 20 }}>
      {!data && !message && <SkeletonRows rows={2} />}
      {rows?.length === 0 && <EmptyState icon="check" title="暂无待处理记录" text="无需操作，有新记录时可在这里核对。" />}
      {rows?.map(row => <div key={row.payment_id || row.order_number} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <Link className={s.mono} style={{ overflowWrap: 'anywhere', minWidth: 0 }} href={`/admin/orders/${encodeURIComponent(row.order_number)}`}>{row.order_number}</Link>
        <Button disabled={busy || refreshing} onClick={() => recover(row.order_number)}>核对并恢复</Button>
      </div>)}
    </Card>)}
    <style jsx global>{`
      .payment-recovery h1, .payment-recovery h2 { font-family: inherit; }
    `}</style>
  </div>
}
