'use client'
import { useEffect, useState } from 'react'

export default function PaymentRecovery() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() {
    const response = await fetch('/api/admin/payment-recovery', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '读取失败')
    setData(result)
  }
  useEffect(() => { load().catch(err => setMessage(err.message)) }, [])
  async function recover(orderNumber) {
    setBusy(true); setMessage('正在核对付款记录…')
    try {
      const response = await fetch('/api/admin/payment-recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '恢复失败，资料已保留')
      setMessage('处理完成：' + orderNumber)
      await load()
    } catch (err) { setMessage(err.message) }
    finally { setBusy(false) }
  }
  const groups = [['待恢复付款', data?.receipts], ['待发送通知', data?.notifications], ['PayPal 待核对（可能尚未付款）', data?.pendingPayPal]]
  return <div style={{ padding: 24 }}>
    <h1>付款恢复</h1>
    <p>核对已有付款并补齐订单、库存和通知。此操作不会发起新的扣款。每组最多显示最早的 100 条。</p>
    <p role="status">{message}</p>
    {groups.map(([title, rows]) => <section key={title} style={{ marginTop: 24 }}>
      <h2>{title}</h2>
      {rows?.length === 0 && <p>暂无记录</p>}
      {rows?.map(row => <div key={row.payment_id || row.order_number} style={{ padding: '12px 0', borderBottom: '1px solid #ddd' }}>
        <span>{row.order_number}</span>{' '}
        <button disabled={busy} onClick={() => recover(row.order_number)}>核对并恢复</button>
      </div>)}
    </section>)}
  </div>
}
