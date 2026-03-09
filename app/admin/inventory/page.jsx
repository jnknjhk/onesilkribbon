'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function InventoryPage() {
  const [skus, setSkus] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterProduct, setFilterProduct] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: prods } = await supabase.from('products').select('id, name').order('name')
    const { data: skuData } = await supabase.from('product_skus').select('*').order('product_id')
    setProducts(prods || [])
    setSkus(skuData || [])
    setLoading(false)
  }

  async function saveStock(id) {
    setSaving(true)
    await supabase.from('product_skus').update({ stock_quantity: parseInt(editVal) || 0 }).eq('id', id)
    setSkus(prev => prev.map(s => s.id === id ? { ...s, stock_quantity: parseInt(editVal) || 0 } : s))
    setEditingId(null)
    setSaving(false)
  }

  const productName = id => products.find(p => p.id === id)?.name || id

  const filtered = skus.filter(s => {
    const matchProduct = filterProduct === 'all' || s.product_id === filterProduct
    const matchSearch = !search || (s.colour || '').toLowerCase().includes(search.toLowerCase()) || productName(s.product_id).toLowerCase().includes(search.toLowerCase())
    return matchProduct && matchSearch
  })

  const lowStock = skus.filter(s => (s.stock_quantity || 0) < 10).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 300, marginBottom: 8 }}>库存管理</h1>
          {lowStock > 0 && <p style={{ color: '#facc15', fontSize: 12 }}>⚠ {lowStock} 个SKU库存低于10</p>}
        </div>
        <p style={{ color: '#555', fontSize: 13 }}>共 {skus.length} 个SKU</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索颜色或产品名…"
          style={{ flex: 1, padding: '9px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          style={{ padding: '9px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#ccc', fontSize: 13, outline: 'none' }}>
          <option value="all">全部产品</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <p style={{ color: '#555', padding: 24 }}>加载中…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                {['产品','颜色','规格','价格(£)','库存','操作'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#444', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const stock = s.stock_quantity || 0
                const stockColor = stock === 0 ? '#f87171' : stock < 10 ? '#facc15' : '#4ade80'
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #1f1f1f' }}>
                    <td style={{ padding: '11px 16px', color: '#aaa', fontSize: 12 }}>{productName(s.product_id)}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.colour_hex && <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.colour_hex, border: '1px solid #333', flexShrink: 0 }} />}
                        <span style={{ color: '#ccc', fontSize: 12 }}>{s.colour || '-'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#888', fontSize: 12 }}>{s.length_metres ? `${s.length_metres}m` : s.width_mm ? `${s.width_mm}mm` : '-'}</td>
                    <td style={{ padding: '11px 16px', color: '#B89B6A', fontSize: 12 }}>{s.price_gbp ? `£${s.price_gbp}` : '-'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {editingId === s.id ? (
                        <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                          autoFocus style={{ width: 70, padding: '4px 8px', background: '#111', border: '1px solid #B89B6A', borderRadius: 4, color: '#fff', fontSize: 12, outline: 'none' }} />
                      ) : (
                        <span style={{ color: stockColor, fontSize: 13, fontWeight: 500 }}>{stock}</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {editingId === s.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => saveStock(s.id)} disabled={saving}
                            style={{ background: '#B89B6A', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                            保存
                          </button>
                          <button onClick={() => setEditingId(null)}
                            style={{ background: '#2a2a2a', border: 'none', borderRadius: 4, color: '#888', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(s.id); setEditVal(String(stock)) }}
                          style={{ background: '#2a2a2a', border: 'none', borderRadius: 4, color: '#888', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                          修改
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
