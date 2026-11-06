'use client'
// 从订单页点"给顾客发邮件"会带上 ?order=订单号，从客户页带 ?to=邮箱&name=姓名，
// 选模板时 {姓名}{订单号}{快递单号}{快递公司} 自动填好；发送前还剩 {…} 就拦下来
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { Card, Field, Input, Textarea, Button, Notice, useToast, styles as s } from '../../ui'

export default function ComposeTab({ get, set }) {
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
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    api('/api/admin/customers?all=1').then(d => setCustomers(d.customers || [])).catch(() => {})
  }, [])

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
