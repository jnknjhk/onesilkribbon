'use client'
import { useState, useEffect, useCallback } from 'react'
import { Pagination } from '@osr/core/components/admin/Pagination'

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', red: '#f87171', green: '#4ade80',
}

const inp = {
  padding: '9px 14px', background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, outline: 'none', color: C.ink,
  fontFamily: "'Jost', sans-serif",
}

const KINDS = [
  { value: '',                   label: '全部类型' },
  { value: 'order_confirmation', label: '订单确认（给客户）' },
  { value: 'owner_notification', label: '新订单通知（给你）' },
  { value: 'shipping',           label: '发货通知' },
  { value: 'contact',            label: '联系表单留言' },
  { value: 'contact_autoreply',  label: '留言自动回复' },
  { value: 'marketing',          label: '后台手动发送' },
]
const kindLabel = v => KINDS.find(k => k.value === v)?.label || v || '—'

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function EmailLogPage() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [notReady, setNotReady] = useState('')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (kind)   params.set('kind', kind)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/emails?${params}`)
      const data = await res.json()
      setEmails(data.emails || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
      setNotReady(data.notReady || '')
    } catch { setEmails([]) }
    setLoading(false)
  }, [page, search, kind, status])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, kind, status])

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>邮件记录</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>
          系统发出的每一封邮件都会记录在这里（成功和失败都记），共 {total} 条
        </p>
      </div>

      {notReady && (
        <div style={{ padding: '14px 18px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#92400E', lineHeight: 1.7 }}>
          ⚠️ {notReady}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索收件人 / 主题 / 订单号…" style={{ ...inp, flex: 1, minWidth: 220 }} />
        <select value={kind} onChange={e => setKind(e.target.value)} style={inp}>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
          <option value="">全部状态</option>
          <option value="sent">已发送</option>
          <option value="failed">发送失败</option>
        </select>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>加载中…</p>
        ) : emails.length === 0 ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>
            {notReady ? '建表后这里会开始出现记录' : (search || kind || status ? '没有匹配的记录' : '暂无邮件记录')}
          </p>
        ) : (
          <table className="admin-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['时间', '类型', '收件人', '主题', '订单号', '状态'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emails.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #F0EDE8' }}>
                  <td data-label="时间" style={{ padding: '10px 16px', color: C.sub, fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(e.created_at)}</td>
                  <td data-label="类型" style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{kindLabel(e.kind)}</td>
                  <td data-label="收件人" style={{ padding: '10px 16px', color: C.ink, fontSize: 12, wordBreak: 'break-all' }}>{e.to_email}</td>
                  <td data-label="主题" style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{e.subject || '—'}</td>
                  <td data-label="订单号" style={{ padding: '10px 16px', color: C.sub, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{e.order_number || '—'}</td>
                  <td data-label="状态" style={{ padding: '10px 16px' }}>
                    <span title={e.error || ''} style={{
                      background: e.status === 'sent' ? C.green + '22' : C.red + '22',
                      color: e.status === 'sent' ? C.green : C.red,
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                      cursor: e.error ? 'help' : 'default',
                    }}>{e.status === 'sent' ? '已发送' : '失败'}</span>
                    {e.error && <p style={{ fontSize: 10, color: C.red, marginTop: 4, maxWidth: 260 }}>{e.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} totalCount={total} onChange={setPage} />
    </div>
  )
}
