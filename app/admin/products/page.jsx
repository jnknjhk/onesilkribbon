'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }

  async function saveProduct() {
    setSaving(true)
    const { error } = await supabase.from('products').update({
      name: editing.name,
      description: editing.description,
      collection: editing.collection,
      active: editing.active,
    }).eq('id', editing.id)
    setSaving(false)
    if (!error) { setMsg('保存成功 ✓'); loadProducts(); setTimeout(() => setMsg(''), 3000) }
    else setMsg('保存失败：' + error.message)
  }

  const collectionLabel = {
    'fine-silk-ribbons': '精品丝带',
    'hand-frayed-silk-ribbons': '手工磨边',
    'handcrafted-adornments': '手工饰品',
    'patterned-ribbons': '图案丝带',
    'studio-tools': '工作室工具',
    'vintage-inspired-ribbons': '复古系列',
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 80px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <h1 style={{ color: '#1C1714', fontSize: 24, fontWeight: 300, marginBottom: 24 }}>产品管理</h1>
        {loading ? <p style={{ color: '#A8A4A0' }}>加载中…</p> : (
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E4DF' }}>
                  {['产品名称','系列','SKU数','状态','操作'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#8A8480', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F0EDE8' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <p style={{ color: '#2E2B28', fontSize: 13 }}>{p.name}</p>
                      <p style={{ color: '#A8A4A0', fontSize: 11, marginTop: 3 }}>{p.slug}</p>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#8A8480', fontSize: 12 }}>{collectionLabel[p.collection] || p.collection}</td>
                    <td style={{ padding: '14px 20px', color: '#8A8480', fontSize: 12 }}>{p.sku_count || '-'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: p.active !== false ? '#4ade8022' : '#f8717122', color: p.active !== false ? '#4ade80' : '#f87171', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>
                        {p.active !== false ? '上架' : '下架'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button onClick={() => setEditing({ ...p })}
                        style={{ background: '#EDE9E4', border: 'none', borderRadius: 6, color: '#B89B6A', fontSize: 11, padding: '6px 14px', cursor: 'pointer' }}>
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ width: 380, background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, padding: 24, overflow: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ color: '#1C1714', fontSize: 15, fontWeight: 400 }}>编辑产品</h2>
            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#A8A4A0', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          {[
            { label: '产品名称', key: 'name', type: 'text' },
            { label: '系列 slug', key: 'collection', type: 'text' },
          ].map(({ label, key, type }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</label>
              <input type={type} value={editing[key] || ''} onChange={e => setEditing(prev => ({ ...prev, [key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', background: '#F5F3F0', border: '1px solid #E8E4DF', borderRadius: 6, color: '#1C1714', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#8A8480', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>产品描述</label>
            <textarea value={editing.description || ''} onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))}
              style={{ width: '100%', minHeight: 120, padding: '10px 12px', background: '#F5F3F0', border: '1px solid #E8E4DF', borderRadius: 6, color: '#1C1714', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing(prev => ({ ...prev, active: e.target.checked }))} />
              <span style={{ color: '#504C48', fontSize: 13 }}>产品上架</span>
            </label>
          </div>
          {msg && <p style={{ color: msg.includes('成功') ? '#4ade80' : '#f87171', fontSize: 12, marginBottom: 12 }}>{msg}</p>}
          <button onClick={saveProduct} disabled={saving}
            style={{ width: '100%', padding: '11px', background: '#B89B6A', border: 'none', borderRadius: 6, color: '#1C1714', fontSize: 12, letterSpacing: '.15em', cursor: 'pointer' }}>
            {saving ? '保存中…' : '保存修改'}
          </button>
        </div>
      )}
    </div>
  )
}
