'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orders').select('customer_email, shipping_name, shipping_city, shipping_country, total_gbp, created_at, status').order('created_at', { ascending: false })
      if (!data) { setLoading(false); return }
      // Group by email
      const map = {}
      data.forEach(o => {
        const email = o.customer_email || 'unknown'
        if (!map[email]) map[email] = { email, name: o.shipping_name, city: o.shipping_city, country: o.shipping_country, orders: 0, spent: 0, lastOrder: o.created_at }
        map[email].orders++
        map[email].spent += parseFloat(o.total_gbp || 0)
        if (o.created_at > map[email].lastOrder) map[email].lastOrder = o.created_at
      })
      setCustomers(Object.values(map).sort((a, b) => b.spent - a.spent))
      setLoading(false)
    }
    load()
  }, [])

  const fmt = n => `£${Number(n).toFixed(2)}`
  const filtered = customers.filter(c => !search || c.email.toLowerCase().includes(search.toLowerCase()) || (c.name || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 80px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 24, fontWeight: 300, marginBottom: 20 }}>客户管理</h1>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索客户邮箱或姓名…"
            style={{ width: '100%', padding: '9px 14px', background: '#242220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.88)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: '#242220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          {loading ? <p style={{ color: 'rgba(255,255,255,0.22)', padding: 24 }}>加载中…</p> : filtered.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.22)', padding: 24, fontSize: 13 }}>暂无客户数据</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['客户','位置','订单数','总消费','最近购买','操作'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.email} onClick={() => setSelected(c)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selected?.email === c.email ? '#1f1f1f' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{c.name || '-'}</p>
                      <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>{c.email}</p>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{[c.city, c.country].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{c.orders}</td>
                    <td style={{ padding: '12px 16px', color: '#B89B6A', fontSize: 13 }}>{fmt(c.spent)}</td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.22)', fontSize: 12 }}>{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('zh-CN') : '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                        style={{ background: '#333130', border: 'none', borderRadius: 4, color: '#B89B6A', fontSize: 11, padding: '5px 12px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                        发邮件
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ width: 280, background: '#242220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: 400 }}>客户详情</h2>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#333130', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 20 }}>
            {(selected.name || selected.email)[0].toUpperCase()}
          </div>
          {[['姓名', selected.name],['邮箱', selected.email],['城市', selected.city],['国家', selected.country],['订单数', selected.orders],['累计消费', fmt(selected.spent)],['最近购买', selected.lastOrder ? new Date(selected.lastOrder).toLocaleDateString('zh-CN') : '-']].map(([label, val]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, wordBreak: 'break-all' }}>{val || '-'}</p>
            </div>
          ))}
          <a href={`mailto:${selected.email}`}
            style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#B89B6A', borderRadius: 6, color: 'rgba(255,255,255,0.88)', fontSize: 12, letterSpacing: '.15em', textDecoration: 'none', marginTop: 20 }}>
            发送邮件
          </a>
        </div>
      )}
    </div>
  )
}
