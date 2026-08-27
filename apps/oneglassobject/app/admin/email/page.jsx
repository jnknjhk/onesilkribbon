'use client'
import { useState, useEffect } from 'react'

const C = { bg: '#F5F3F0', border: '#E8E4DF', gold: '#B89B6A', ink: '#1C1714', muted: '#A8A4A0', sub: '#6B6460' }

const TEMPLATES = [
  {
    label: '发货通知',
    subject: 'Your Order Is On Its Way — [订单号]',
    body: `Dear [姓名],

Your One Glass Object order has been carefully packaged and is now on its way to you.

Order: [订单号]
Tracking: [快递单号]
Carrier: [快递公司]

We hope you love your ribbons as much as we loved making them.

Warm regards,
Song
One Glass Object`,
  },
  {
    label: '订单跟进',
    subject: 'Following Up — Your Order [订单号]',
    body: `Dear [姓名],

I wanted to personally follow up on your recent order ([订单号]).

[在这里填写内容]

As a token of appreciation, please enjoy 20% off your next order with code: SORRY20

Thank you for your support.

Warm regards,
Song
One Glass Object`,
  },
  {
    label: '感谢邮件',
    subject: 'Thank You for Your Order — One Glass Object',
    body: `Dear [姓名],

Thank you so much for your order — it truly means the world to us.

Every ribbon is handcrafted with care, and we hope it brings a touch of beauty to whatever occasion you have in mind.

If you have any questions or need anything at all, please don't hesitate to reach out.

With warmth,
Song
One Glass Object`,
  },
  {
    label: '空白模板',
    subject: '',
    body: '',
  },
]

export default function EmailPage() {
  const [customers, setCustomers] = useState([])
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    fetch('/api/admin/customers')
      .then(r => r.json())
      .then(data => setCustomers(data.customers || []))
      .catch(() => {})
  }, [])

  const applyTemplate = (t) => {
    setSelectedTemplate(t.label)
    setSubject(t.subject)
    setBody(t.body)
    setResult(null)
  }

  const handleSend = async () => {
    if (!to || !subject || !body) { setResult({ error: '请填写收件人、主题和正文' }); return }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: `邮件已成功发送至 ${to}` })
        setTo(''); setSubject(''); setBody(''); setSelectedTemplate(null)
      } else {
        setResult({ error: data.error || '发送失败' })
      }
    } catch {
      setResult({ error: '网络错误，请重试' })
    }
    setSending(false)
  }

  return (
    <div>
      <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 28 }}>发送邮件</h1>

      <div className="admin-flex-stack" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* 左侧：模板 + 客户 */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <p style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>快捷模板</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => applyTemplate(t)}
                style={{ padding: '9px 14px', background: selectedTemplate === t.label ? `rgba(184,155,106,0.12)` : '#fff', border: `1px solid ${selectedTemplate === t.label ? C.gold : C.border}`, borderRadius: 8, color: selectedTemplate === t.label ? C.gold : C.sub, fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>历史客户</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflow: 'auto' }}>
            {customers.map(c => (
              <button key={c.email} onClick={() => setTo(c.email)}
                style={{ padding: '8px 12px', background: to === c.email ? `rgba(184,155,106,0.12)` : '#fff', border: `1px solid ${to === c.email ? C.gold : C.border}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                <p style={{ fontSize: 12, color: C.ink, margin: 0 }}>{c.name || '—'}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{c.email}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：编辑区 */}
        <div style={{ flex: 1, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 28 }}>

          {result && (
            <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: result.success ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${result.success ? '#4ade80' : '#f87171'}`, color: result.success ? '#166534' : '#991b1b', fontSize: 13 }}>
              {result.success || result.error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: 6 }}>收件人</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="客户邮箱地址"
              style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.ink, outline: 'none', fontFamily: "'Jost', sans-serif", boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: 6 }}>主题</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="邮件主题"
              style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.ink, outline: 'none', fontFamily: "'Jost', sans-serif", boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: 6 }}>正文</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="邮件正文内容…" rows={14}
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.ink, outline: 'none', fontFamily: "'Jost', sans-serif", resize: 'vertical', lineHeight: 1.8, boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 11, color: C.muted }}>发件人：hello@oneglassobject.com</p>
            <button onClick={handleSend} disabled={sending} className="admin-tap-target"
              style={{ padding: '11px 28px', background: sending ? C.border : C.ink, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, letterSpacing: '.08em', cursor: sending ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif", transition: 'background .15s' }}>
              {sending ? '发送中…' : '发送邮件'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
