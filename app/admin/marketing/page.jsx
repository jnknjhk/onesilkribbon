'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_gbp: '', max_uses: '', expires_at: '', active: true }

export default function MarketingPage() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { loadCoupons() }, [])

  async function loadCoupons() {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoading(false)
  }

  async function saveCoupon() {
    if (!form.code || !form.discount_value) { setMsg('请填写优惠码和折扣值'); return }
    setSaving(true)
    const payload = {
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_gbp: parseFloat(form.min_order_gbp) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at || null,
      active: form.active,
    }
    let error
    if (editing) {
      ({ error } = await supabase.from('coupons').update(payload).eq('id', editing))
    } else {
      ({ error } = await supabase.from('coupons').insert(payload))
    }
    setSaving(false)
    if (!error) {
      setMsg(editing ? '已更新 ✓' : '已创建 ✓')
      setForm(EMPTY); setEditing(null); setShowForm(false)
      loadCoupons()
      setTimeout(() => setMsg(''), 3000)
    } else {
      setMsg('错误：' + (error.message.includes('unique') ? '优惠码已存在' : error.message))
    }
  }

  async function toggleActive(id, active) {
    await supabase.from('coupons').update({ active: !active }).eq('id', id)
    loadCoupons()
  }

  async function deleteCoupon(id) {
    if (!confirm('确定删除这个优惠码？')) return
    await supabase.from('coupons').delete().eq('id', id)
    loadCoupons()
  }

  function startEdit(c) {
    setForm({ ...c, expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '', max_uses: c.max_uses || '', min_order_gbp: c.min_order_gbp || '' })
    setEditing(c.id)
    setShowForm(true)
  }

  const fmtDiscount = c => c.discount_type === 'percentage' ? `${c.discount_value}% 折扣` : `£${c.discount_value} 减免`
  const fmtDate = s => s ? new Date(s).toLocaleDateString('zh-CN') : '无限期'
  const isExpired = c => c.expires_at && new Date(c.expires_at) < new Date()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ color: '#1C1714', fontSize: 24, fontWeight: 300, marginBottom: 8 }}>营销管理</h1>
          <p style={{ color: '#A8A4A0', fontSize: 13 }}>创建和管理优惠码</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}
          style={{ background: '#B89B6A', border: 'none', borderRadius: 8, color: '#1C1714', fontSize: 12, padding: '10px 20px', cursor: 'pointer', letterSpacing: '.1em' }}>
          + 新建优惠码
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: '优惠码总数', value: coupons.length },
          { label: '当前有效', value: coupons.filter(c => c.active && !isExpired(c)).length, color: '#4ade80' },
          { label: '累计使用次数', value: coupons.reduce((s, c) => s + (c.uses_count || 0), 0), color: '#B89B6A' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ color: '#A8A4A0', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</p>
            <p style={{ color: color || '#fff', fontSize: 28, fontWeight: 300 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? <p style={{ color: '#A8A4A0', padding: 24 }}>加载中…</p> : coupons.length === 0 ? (
            <p style={{ color: '#A8A4A0', padding: 24, fontSize: 13 }}>暂无优惠码，点击右上角新建</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E4DF' }}>
                  {['优惠码', '折扣', '最低订单', '使用情况', '有效期', '状态', '操作'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#8A8480', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const expired = isExpired(c)
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F0EDE8', opacity: expired ? 0.5 : 1 }}>
                      <td style={{ padding: '13px 16px' }}>
                        <p style={{ color: '#1C1714', fontSize: 13, fontFamily: 'monospace', letterSpacing: '.08em' }}>{c.code}</p>
                        {c.description && <p style={{ color: '#A8A4A0', fontSize: 11, marginTop: 3 }}>{c.description}</p>}
                      </td>
                      <td style={{ padding: '13px 16px', color: '#B89B6A', fontSize: 13 }}>{fmtDiscount(c)}</td>
                      <td style={{ padding: '13px 16px', color: '#8A8480', fontSize: 12 }}>{c.min_order_gbp > 0 ? `£${c.min_order_gbp}` : '无要求'}</td>
                      <td style={{ padding: '13px 16px', color: '#8A8480', fontSize: 12 }}>
                        {c.uses_count || 0}{c.max_uses ? ` / ${c.max_uses}` : ' / ∞'}
                      </td>
                      <td style={{ padding: '13px 16px', color: expired ? '#f87171' : '#888', fontSize: 12 }}>{fmtDate(c.expires_at)}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <button onClick={() => toggleActive(c.id, c.active)}
                          style={{ background: (c.active && !expired) ? '#4ade8022' : '#f8717122', color: (c.active && !expired) ? '#4ade80' : '#f87171', border: 'none', borderRadius: 20, fontSize: 11, padding: '3px 12px', cursor: 'pointer' }}>
                          {c.active && !expired ? '有效' : expired ? '已过期' : '已停用'}
                        </button>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startEdit(c)} style={{ background: '#EDE9E4', border: 'none', borderRadius: 4, color: '#B89B6A', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>编辑</button>
                          <button onClick={() => deleteCoupon(c.id)} style={{ background: '#EDE9E4', border: 'none', borderRadius: 4, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>删除</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Form panel */}
        {showForm && (
          <div style={{ width: 340, background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, padding: 24, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: '#1C1714', fontSize: 15, fontWeight: 400 }}>{editing ? '编辑优惠码' : '新建优惠码'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} style={{ background: 'none', border: 'none', color: '#A8A4A0', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            {[
              { label: '优惠码（英文大写）', key: 'code', type: 'text', placeholder: 'WELCOME10' },
              { label: '描述（可选）', key: 'description', type: 'text', placeholder: '新客户专属优惠' },
              { label: '折扣值', key: 'discount_value', type: 'number', placeholder: '10' },
              { label: '最低订单金额 £（可选）', key: 'min_order_gbp', type: 'number', placeholder: '0' },
              { label: '最大使用次数（空=无限）', key: 'max_uses', type: 'number', placeholder: '100' },
              { label: '有效期至（空=永久）', key: 'expires_at', type: 'date', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', background: '#F5F3F0', border: '1px solid #E8E4DF', borderRadius: 6, color: '#1C1714', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>折扣类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['percentage', '百分比折扣'], ['fixed', '固定金额减免']].map(([val, label]) => (
                  <button key={val} onClick={() => setForm(p => ({ ...p, discount_type: val }))}
                    style={{ flex: 1, padding: '8px', background: form.discount_type === val ? '#B89B6A' : '#111', border: `1px solid ${form.discount_type === val ? '#B89B6A' : '#2a2a2a'}`, borderRadius: 6, color: form.discount_type === val ? '#fff' : '#666', fontSize: 11, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ color: '#8A8480', fontSize: 11, marginTop: 6 }}>
                {form.discount_type === 'percentage' ? '例：10 = 打九折（减少10%）' : '例：5 = 减£5'}
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                <span style={{ color: '#504C48', fontSize: 13 }}>立即生效</span>
              </label>
            </div>

            {msg && <p style={{ color: msg.includes('✓') ? '#4ade80' : '#f87171', fontSize: 12, marginBottom: 12 }}>{msg}</p>}
            <button onClick={saveCoupon} disabled={saving}
              style={{ width: '100%', padding: '11px', background: '#B89B6A', border: 'none', borderRadius: 6, color: '#1C1714', fontSize: 12, letterSpacing: '.15em', cursor: 'pointer' }}>
              {saving ? '保存中…' : editing ? '保存修改' : '创建优惠码'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
