'use client'
import { useState, useEffect } from 'react'
import { Pagination } from '@/components/admin/Pagination'

const PAGE_SIZE = 30
const C = {
  border: '#E8E4DF', gold: '#B89B6A', ink: '#1C1714',
  sub: '#6B6460', muted: '#A8A4A0', row: '#FAFAF8',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | registered | guest
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/customers')
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch { setCustomers([]) }
    setLoading(false)
  }

  const fmt = n => `£${Number(n).toFixed(2)}`
  const fmtDate = s => s ? new Date(s).toLocaleDateString('zh-CN') : '-'

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.email.toLowerCase().includes(search.toLowerCase()) || (c.name || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'registered' ? !!c.user_id : !c.user_id)
    return matchSearch && matchFilter
  })

  const registeredCount = customers.filter(c => c.user_id).length
  const guestCount = customers.filter(c => !c.user_id).length
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filter])

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 80px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 16 }}>客户管理</h1>

          {/* 统计 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {[
              { label: '全部', value: customers.length, key: 'all' },
              { label: '已注册', value: registeredCount, key: 'registered' },
              { label: '访客', value: guestCount, key: 'guest' },
            ].map(item => (
              <button key={item.key} onClick={() => setFilter(item.key)} style={{
                padding: '8px 16px', border: `1px solid ${filter === item.key ? C.gold : C.border}`,
                background: filter === item.key ? `rgba(184,155,106,0.08)` : '#fff',
                color: filter === item.key ? C.gold : C.sub,
                fontSize: 12, cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                transition: 'all 0.15s',
              }}>
                {item.label} <span style={{ fontWeight: 500 }}>{item.value}</span>
              </button>
            ))}
          </div>

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索客户邮箱或姓名…"
            style={{ width: '100%', padding: '9px 14px', background: '#FFFFFF', border: `1px solid ${C.border}`, color: C.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: '#FFFFFF', border: `1px solid ${C.border}` }}>
          {loading ? <p style={{ color: C.muted, padding: 24 }}>加载中…</p> : filtered.length === 0 ? (
            <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>暂无客户数据</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['客户', '类型', '位置', '订单数', '总消费', '最近购买', '操作'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr key={c.email} onClick={() => setSelected(c)}
                    style={{ borderBottom: `1px solid #F0EDE8`, cursor: 'pointer', background: selected?.email === c.email ? C.row : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (selected?.email !== c.email) e.currentTarget.style.background = C.row }}
                    onMouseLeave={e => { if (selected?.email !== c.email) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ color: C.ink, fontSize: 13 }}>{c.name || '-'}</p>
                      <p style={{ color: C.muted, fontSize: 11 }}>{c.email}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.user_id ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(184,155,106,0.1)', color: C.gold, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>已注册</span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '2px 8px', background: '#F5F3F0', color: C.muted, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>访客</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: C.sub, fontSize: 12 }}>{[c.city, c.country].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ padding: '12px 16px', color: C.ink, fontSize: 13 }}>{c.orders}</td>
                    <td style={{ padding: '12px 16px', color: C.gold, fontSize: 13 }}>{fmt(c.spent)}</td>
                    <td style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>{fmtDate(c.lastOrder)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                        style={{ background: '#F0EDE8', border: 'none', color: C.gold, fontSize: 11, padding: '5px 12px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', letterSpacing: '.06em' }}>
                        发邮件
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} totalCount={filtered.length} onChange={setPage} />
      </div>

      {/* 详情面板 */}
      {selected && (
        <div style={{ width: 280, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 24, flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ color: C.ink, fontSize: 15, fontWeight: 400 }}>客户详情</h2>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>

          {/* 头像 + 类型标签 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {selected.profile?.avatar_url ? (
              <img src={selected.profile.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.gold}` }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EDE9E4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: C.sub }}>
                {(selected.name || selected.email)[0].toUpperCase()}
              </div>
            )}
            <div>
              {selected.user_id ? (
                <span style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(184,155,106,0.1)', color: C.gold, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>已注册会员</span>
              ) : (
                <span style={{ display: 'inline-block', padding: '2px 8px', background: '#F5F3F0', color: C.muted, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>访客购买</span>
              )}
            </div>
          </div>

          {[
            ['姓名', selected.profile ? `${selected.profile.first_name || ''} ${selected.profile.last_name || ''}`.trim() || selected.name : selected.name],
            ['邮箱', selected.email],
            ['城市', selected.city],
            ['国家', selected.country],
            ['订单数', selected.orders],
            ['累计消费', fmt(selected.spent)],
            ['最近购买', fmtDate(selected.lastOrder)],
            ...(selected.profile ? [['注册时间', fmtDate(selected.profile.created_at)]] : []),
          ].map(([label, val]) => (
            <div key={label} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid #F5F3F0` }}>
              <p style={{ color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
              <p style={{ color: C.sub, fontSize: 13, wordBreak: 'break-all' }}>{val || '-'}</p>
            </div>
          ))}

          <a href={`mailto:${selected.email}`}
            style={{ display: 'block', textAlign: 'center', padding: '10px', background: C.gold, color: '#fff', fontSize: 11, letterSpacing: '.15em', textDecoration: 'none', marginTop: 8, textTransform: 'uppercase' }}>
            发送邮件
          </a>
        </div>
      )}
    </div>
  )
}
