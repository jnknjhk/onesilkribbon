'use client'
import { useState, useEffect, useCallback } from 'react'
import { Pagination } from '@osr/core/components/admin/Pagination'

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', light: '#EDE9E4', green: '#4ade80',
}

const inp = {
  padding: '9px 14px', background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, outline: 'none', color: C.ink,
  fontFamily: "'Jost', sans-serif",
}

const SOURCES = [
  { value: '', label: '全部来源' },
  { value: 'welcome_popup', label: '欢迎弹窗' },
  { value: 'home_newsletter', label: '首页订阅区块' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sourceLabel(value) {
  return SOURCES.find(s => s.value === value)?.label || value || '—'
}

// 简单的 CSV 字段转义：包含逗号/引号/换行的字段用双引号包裹，内部双引号转义成两个双引号
function csvField(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (source) params.set('source', source)
      const res = await fetch(`/api/admin/subscribers?${params}`)
      const data = await res.json()
      setSubscribers(data.subscribers || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch { setSubscribers([]) }
    setLoading(false)
  }, [page, search, source])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, source])

  async function exportCSV() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ all: '1' })
      if (search) params.set('search', search)
      if (source) params.set('source', source)
      const res = await fetch(`/api/admin/subscribers?${params}`)
      const data = await res.json()
      const rows = data.subscribers || []

      const header = ['Email', 'Source', 'Status', 'Subscribed At']
      const lines = [header.map(csvField).join(',')]
      for (const s of rows) {
        lines.push([
          s.email,
          sourceLabel(s.source),
          s.verified ? 'Verified' : 'Pending',
          formatDate(s.subscribed_at || s.created_at),
        ].map(csvField).join(','))
      }
      const csv = '﻿' + lines.join('\r\n') // BOM 前缀，避免 Excel 打开中文/特殊字符乱码

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
    setExporting(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>订阅用户</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>共 {total} 位订阅者</p>
        </div>
        <button onClick={exportCSV} disabled={exporting} style={{
          background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12,
          padding: '10px 24px', cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.7 : 1,
        }}>
          {exporting ? '导出中…' : '⬇ 导出 CSV'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="按邮箱搜索…"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select value={source} onChange={e => setSource(e.target.value)} style={inp}>
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>加载中…</p>
        ) : subscribers.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: C.muted, fontSize: 13 }}>{search || source ? '没有匹配的订阅者' : '暂无订阅者'}</p>
          </div>
        ) : (
          <table className="admin-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['邮箱', '来源', '状态', '订阅时间'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscribers.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F0EDE8' }}>
                  <td data-label="邮箱" style={{ padding: '10px 16px', color: C.ink, fontSize: 13 }}>{s.email}</td>
                  <td data-label="来源" style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{sourceLabel(s.source)}</td>
                  <td data-label="状态" style={{ padding: '10px 16px' }}>
                    <span style={{
                      background: s.verified ? C.green + '22' : C.muted + '22',
                      color: s.verified ? C.green : C.muted,
                      fontSize: 11, padding: '3px 10px', borderRadius: 20,
                    }}>{s.verified ? '已验证' : '待验证'}</span>
                  </td>
                  <td data-label="订阅时间" style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{formatDate(s.subscribed_at || s.created_at)}</td>
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
