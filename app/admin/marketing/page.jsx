'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', light: '#EDE9E4', red: '#f87171', green: '#4ade80',
}

const inp = {
  width: '100%', padding: '9px 12px',
  background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 6, color: C.ink, fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
}

const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_gbp: '', max_uses: '', expires_at: '', active: true }

export default function MarketingPage() {
  // ── 运费设置 ──
  const [shipping, setShipping] = useState({ shipping_rate: '3.95', free_shipping_threshold: '45.00', free_shipping_enabled: 'true' })
  const [shippingLoading, setShippingLoading] = useState(true)
  const [shippingMsg, setShippingMsg] = useState('')
  const [shippingSaving, setShippingSaving] = useState(false)

  // ── 优惠码 ──
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadShipping()
    loadCoupons()
  }, [])

  // ── 运费 ────────────────────────────────────────────────
  async function loadShipping() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.shipping_rate) setShipping({
        shipping_rate: data.shipping_rate,
        free_shipping_threshold: data.free_shipping_threshold || '45.00',
        free_shipping_enabled: data.free_shipping_enabled ?? 'true',
      })
    } catch {}
    setShippingLoading(false)
  }

  async function saveShipping() {
    setShippingSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipping),
      })
      setShippingMsg('已保存 ✓')
      setTimeout(() => setShippingMsg(''), 3000)
    } catch {
      setShippingMsg('保存失败')
    }
    setShippingSaving(false)
  }

  // ── 优惠码 ───────────────────────────────────────────────
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
    setEditing(c.id); setShowForm(true)
  }

  const fmtDiscount = c => c.discount_type === 'percentage' ? `${c.discount_value}% 折扣` : `£${c.discount_value} 减免`
  const fmtDate = s => s ? new Date(s).toLocaleDateString('zh-CN') : '无限期'
  const isExpired = c => c.expires_at && new Date(c.expires_at) < new Date()

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>营销管理</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>运费设置与优惠码管理</p>
      </div>

      {/* ── 运费设置 ── */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: C.ink, fontSize: 16, fontWeight: 400, marginBottom: 4 }}>运费设置</h2>
            <p style={{ color: C.muted, fontSize: 12 }}>修改后立即生效，无需重新部署</p>
          </div>
          {shippingMsg && (
            <span style={{ color: shippingMsg.includes('✓') ? C.green : C.red, fontSize: 13 }}>{shippingMsg}</span>
          )}
        </div>

        {shippingLoading ? (
          <p style={{ color: C.muted, fontSize: 13 }}>加载中…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
            {/* 运费金额 */}
            <div>
              <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                运费金额 (£)
              </label>
              <input
                type="number" step="0.01" min="0"
                value={shipping.shipping_rate}
                onChange={e => setShipping(s => ({ ...s, shipping_rate: e.target.value }))}
                style={inp}
              />
            </div>

            {/* 免运费门槛 */}
            <div>
              <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                免运费门槛 (£)
              </label>
              <input
                type="number" step="0.01" min="0"
                value={shipping.free_shipping_threshold}
                onChange={e => setShipping(s => ({ ...s, free_shipping_threshold: e.target.value }))}
                style={{ ...inp, opacity: shipping.free_shipping_enabled === 'false' ? 0.4 : 1 }}
                disabled={shipping.free_shipping_enabled === 'false'}
              />
            </div>

            {/* 免运费开关 */}
            <div>
              <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                免运费活动
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['true', '开启'], ['false', '关闭']].map(([val, label]) => (
                  <button key={val}
                    onClick={() => setShipping(s => ({ ...s, free_shipping_enabled: val }))}
                    style={{
                      flex: 1, padding: '9px 0',
                      background: shipping.free_shipping_enabled === val ? (val === 'true' ? '#4ade8022' : '#f8717122') : C.bg,
                      border: `1px solid ${shipping.free_shipping_enabled === val ? (val === 'true' ? C.green : C.red) : C.border}`,
                      borderRadius: 6,
                      color: shipping.free_shipping_enabled === val ? (val === 'true' ? C.green : C.red) : C.muted,
                      fontSize: 12, cursor: 'pointer',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 保存按钮 */}
            <button onClick={saveShipping} disabled={shippingSaving}
              style={{ padding: '9px 24px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {shippingSaving ? '保存中…' : '保存运费'}
            </button>
          </div>
        )}

        {/* 预览说明 */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.sub }}>
          当前设置：运费 £{shipping.shipping_rate}，
          {shipping.free_shipping_enabled === 'true'
            ? `订单满 £${shipping.free_shipping_threshold} 免运费`
            : '免运费活动已关闭（所有订单均收取运费）'}
        </div>
      </div>

      {/* ── 优惠码区块 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: C.ink, fontSize: 16, fontWeight: 400, marginBottom: 4 }}>优惠码</h2>
          <p style={{ color: C.muted, fontSize: 12 }}>创建和管理折扣码</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}
          style={{ background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '10px 20px', cursor: 'pointer', letterSpacing: '.08em' }}>
          + 新建优惠码
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '优惠码总数', value: coupons.length },
          { label: '当前有效', value: coupons.filter(c => c.active && !isExpired(c)).length, color: C.green },
          { label: '累计使用次数', value: coupons.reduce((s, c) => s + (c.uses_count || 0), 0), color: C.gold },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px' }}>
            <p style={{ color: C.muted, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
            <p style={{ color: color || C.ink, fontSize: 26, fontWeight: 300 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? <p style={{ color: C.muted, padding: 24 }}>加载中…</p> : coupons.length === 0 ? (
            <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>暂无优惠码，点击右上角新建</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['优惠码', '折扣', '最低订单', '使用情况', '有效期', '状态', '操作'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const expired = isExpired(c)
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid #F0EDE8`, opacity: expired ? 0.5 : 1 }}>
                      <td style={{ padding: '13px 16px' }}>
                        <p style={{ color: C.ink, fontSize: 13, fontFamily: 'monospace', letterSpacing: '.08em' }}>{c.code}</p>
                        {c.description && <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{c.description}</p>}
                      </td>
                      <td style={{ padding: '13px 16px', color: C.gold, fontSize: 13 }}>{fmtDiscount(c)}</td>
                      <td style={{ padding: '13px 16px', color: C.sub, fontSize: 12 }}>{c.min_order_gbp > 0 ? `£${c.min_order_gbp}` : '无要求'}</td>
                      <td style={{ padding: '13px 16px', color: C.sub, fontSize: 12 }}>
                        {c.uses_count || 0}{c.max_uses ? ` / ${c.max_uses}` : ' / ∞'}
                      </td>
                      <td style={{ padding: '13px 16px', color: expired ? C.red : C.sub, fontSize: 12 }}>{fmtDate(c.expires_at)}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <button onClick={() => toggleActive(c.id, c.active)}
                          style={{ background: (c.active && !expired) ? '#4ade8022' : '#f8717122', color: (c.active && !expired) ? C.green : C.red, border: 'none', borderRadius: 20, fontSize: 11, padding: '3px 12px', cursor: 'pointer' }}>
                          {c.active && !expired ? '有效' : expired ? '已过期' : '已停用'}
                        </button>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startEdit(c)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.gold, fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>编辑</button>
                          <button onClick={() => deleteCoupon(c.id)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.red, fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>删除</button>
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
          <div style={{ width: 340, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: C.ink, fontSize: 15, fontWeight: 400 }}>{editing ? '编辑优惠码' : '新建优惠码'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
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
                <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={inp} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>折扣类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['percentage', '百分比折扣'], ['fixed', '固定金额减免']].map(([val, label]) => (
                  <button key={val} onClick={() => setForm(p => ({ ...p, discount_type: val }))}
                    style={{ flex: 1, padding: '8px', background: form.discount_type === val ? C.gold : C.bg, border: `1px solid ${form.discount_type === val ? C.gold : C.border}`, borderRadius: 6, color: form.discount_type === val ? '#fff' : C.sub, fontSize: 11, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
                {form.discount_type === 'percentage' ? '例：10 = 打九折（减少10%）' : '例：5 = 减£5'}
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                <span style={{ color: C.sub, fontSize: 13 }}>立即生效</span>
              </label>
            </div>

            {msg && <p style={{ color: msg.includes('✓') ? C.green : C.red, fontSize: 12, marginBottom: 12 }}>{msg}</p>}
            <button onClick={saveCoupon} disabled={saving}
              style={{ width: '100%', padding: '11px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, letterSpacing: '.15em', cursor: 'pointer' }}>
              {saving ? '保存中…' : editing ? '保存修改' : '创建优惠码'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
