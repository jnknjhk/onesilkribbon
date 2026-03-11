'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const COLLECTIONS = [
  { value: 'fine-silk-ribbons',        label: '精品丝带 Fine Silk Ribbons' },
  { value: 'hand-frayed-silk-ribbons', label: '手工磨边 Hand-Frayed' },
  { value: 'handcrafted-adornments',   label: '手工饰品 Adornments' },
  { value: 'patterned-ribbons',        label: '图案丝带 Patterned' },
  { value: 'studio-tools',             label: '工作室工具 Studio Tools' },
  { value: 'vintage-inspired-ribbons', label: '复古系列 Vintage-Inspired' },
]

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', goldDark: '#9A7E50', ink: '#1C1714',
  sub: '#6B6460', muted: '#A8A4A0', light: '#EDE9E4',
  red: '#f87171', green: '#4ade80', row: '#FAFAF8',
}

const inp = {
  width: '100%', padding: '10px 14px', background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Jost', sans-serif",
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)       // null = 列表视图, 'new' = 新建, product object = 编辑
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterCol, setFilterCol] = useState('all')

  // ── 产品表单 ──
  const [form, setForm] = useState({ name: '', slug: '', description: '', collection: 'fine-silk-ribbons', active: true })
  const [images, setImages] = useState([])            // [{url, isNew}]
  const [uploading, setUploading] = useState(false)
  const [skus, setSkus] = useState([])                // [{id?, colour, colour_hex, width_mm, length_m, price_gbp, stock_qty, is_active}]
  const [deletedSkuIds, setDeletedSkuIds] = useState([])
  const [deletedImageUrls, setDeletedImageUrls] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  // ── 开始编辑/新建 ──
  async function startEdit(product) {
    if (product === 'new') {
      setForm({ name: '', slug: '', description: '', collection: 'fine-silk-ribbons', active: true })
      setImages([])
      setSkus([])
      setDeletedSkuIds([])
      setDeletedImageUrls([])
      setEditing('new')
    } else {
      setForm({
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        collection: product.collection || 'fine-silk-ribbons',
        active: product.active !== false && product.is_active !== false,
      })
      setImages((product.images || []).map(url => ({ url, isNew: false })))
      // 加载 SKU
      const { data: skuData } = await supabase
        .from('product_skus')
        .select('*')
        .eq('product_id', product.id)
        .order('colour')
      setSkus((skuData || []).map(s => ({ ...s, _existing: true })))
      setDeletedSkuIds([])
      setDeletedImageUrls([])
      setEditing(product)
    }
    setMsg('')
  }

  // ── 图片上传 ──
  async function handleImageUpload(e) {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)

    // 如果是新产品还没有 ID，先用临时 ID
    const productId = editing === 'new' ? 'temp-' + Date.now() : editing.id

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('productId', productId)

      try {
        const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.url) {
          setImages(prev => [...prev, { url: data.url, isNew: true }])
        } else {
          setMsg('图片上传失败：' + (data.error || '未知错误'))
        }
      } catch (err) {
        setMsg('图片上传失败：' + err.message)
      }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(index) {
    const img = images[index]
    if (img && !img.isNew) {
      setDeletedImageUrls(prev => [...prev, img.url])
    } else if (img && img.isNew) {
      // 新上传的图片直接从 storage 删除
      fetch('/api/admin/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: img.url }),
      }).catch(() => {})
    }
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  function moveImage(index, direction) {
    setImages(prev => {
      const arr = [...prev]
      const target = index + direction
      if (target < 0 || target >= arr.length) return arr
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr
    })
  }

  // ── SKU 管理 ──
  function addSku() {
    setSkus(prev => [...prev, {
      _temp_id: Date.now(),
      colour: '', colour_hex: '#D4C5B0', width_mm: '',
      length_m: 10, price_gbp: '', stock_qty: 0, is_active: true,
    }])
  }

  function updateSku(index, field, value) {
    setSkus(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function removeSku(index) {
    const sku = skus[index]
    if (sku.id) setDeletedSkuIds(prev => [...prev, sku.id])
    setSkus(prev => prev.filter((_, i) => i !== index))
  }

  // ── 保存产品 ──
  async function saveProduct() {
    if (!form.name.trim()) { setMsg('请填写产品名称'); return }
    if (!form.slug.trim()) { setMsg('请填写 URL Slug'); return }

    setSaving(true)
    setMsg('')

    try {
      const imageUrls = images.map(img => img.url)
      const productData = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        collection: form.collection,
        is_active: form.active,
        is_featured: false,
        images: imageUrls,
      }

      let productId

      if (editing === 'new') {
        // 新建产品
        const { data, error } = await supabase.from('products').insert(productData).select('id').single()
        if (error) throw error
        productId = data.id
      } else {
        // 更新产品
        productId = editing.id
        const { error } = await supabase.from('products').update(productData).eq('id', productId)
        if (error) throw error
      }

      // 删除被移除的图片文件
      for (const url of deletedImageUrls) {
        await fetch('/api/admin/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        }).catch(() => {})
      }

      // 删除被移除的 SKU
      for (const skuId of deletedSkuIds) {
        await supabase.from('product_skus').delete().eq('id', skuId)
      }

      // 保存 SKU
      for (const sku of skus) {
        const skuData = {
          product_id: productId,
          colour: sku.colour || '默认',
          colour_hex: sku.colour_hex || '#D4C5B0',
          width_mm: sku.width_mm ? parseInt(sku.width_mm) : null,
          length_m: sku.length_m ? parseInt(sku.length_m) : 10,
          price_gbp: parseFloat(sku.price_gbp) || 0,
          stock_qty: parseInt(sku.stock_qty) || 0,
          is_active: sku.is_active !== false,
        }

        if (sku.id) {
          // 更新已有 SKU
          await supabase.from('product_skus').update(skuData).eq('id', sku.id)
        } else {
          // 新建 SKU — 生成 sku_code
          skuData.sku_code = `${form.slug}-${(sku.colour || 'default').toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`
          await supabase.from('product_skus').insert(skuData)
        }
      }

      setMsg('保存成功 ✓')
      setTimeout(() => {
        setEditing(null)
        loadProducts()
      }, 800)
    } catch (err) {
      setMsg('保存失败：' + err.message)
    }

    setSaving(false)
  }

  // ── 删除产品 ──
  async function deleteProduct(product) {
    if (!confirm(`确定删除「${product.name}」？此操作不可恢复。`)) return
    await supabase.from('product_skus').delete().eq('product_id', product.id)
    await supabase.from('products').delete().eq('id', product.id)
    // 删除 storage 图片
    if (product.images) {
      for (const url of product.images) {
        await fetch('/api/admin/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        }).catch(() => {})
      }
    }
    loadProducts()
  }

  // ── 过滤 ──
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.slug?.toLowerCase().includes(search.toLowerCase())
    const matchCol = filterCol === 'all' || p.collection === filterCol
    return matchSearch && matchCol
  })

  const collectionLabel = v => COLLECTIONS.find(c => c.value === v)?.label || v

  // ═══════════════════════════════════════════════════════
  // 编辑/新建界面
  // ═══════════════════════════════════════════════════════
  if (editing !== null) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* 顶部栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <button onClick={() => setEditing(null)} style={{
              background: 'none', border: 'none', color: C.gold, fontSize: 12,
              cursor: 'pointer', marginBottom: 8, padding: 0, display: 'block',
            }}>← 返回产品列表</button>
            <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300 }}>
              {editing === 'new' ? '新建产品' : `编辑：${form.name}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {msg && <span style={{ color: msg.includes('✓') ? C.green : C.red, fontSize: 12 }}>{msg}</span>}
            <button onClick={saveProduct} disabled={saving} style={{
              padding: '10px 28px', background: C.gold, border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer',
              letterSpacing: '.08em', opacity: saving ? 0.7 : 1,
            }}>{saving ? '保存中…' : '保存产品'}</button>
          </div>
        </div>

        {/* ── 基本信息 ── */}
        <Section title="基本信息">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label>产品名称 *</Label>
              <input value={form.name} onChange={e => {
                const name = e.target.value
                setForm(p => ({ ...p, name, slug: editing === 'new' ? slugify(name) : p.slug }))
              }} style={inp} placeholder="Mulberry Silk Ribbon" />
            </div>
            <div>
              <Label>URL Slug *</Label>
              <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                style={inp} placeholder="mulberry-silk-ribbon" />
            </div>
            <div>
              <Label>所属系列</Label>
              <select value={form.collection} onChange={e => setForm(p => ({ ...p, collection: e.target.value }))} style={inp}>
                {COLLECTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label>状态</Label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[{ v: true, l: '上架', c: C.green }, { v: false, l: '下架', c: C.red }].map(({ v, l, c }) => (
                  <button key={l} onClick={() => setForm(p => ({ ...p, active: v }))} style={{
                    flex: 1, padding: '10px 0', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: form.active === v ? c + '22' : C.bg,
                    border: `1px solid ${form.active === v ? c : C.border}`,
                    color: form.active === v ? c : C.muted,
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Label>产品描述</Label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ ...inp, minHeight: 120, resize: 'vertical' }}
              placeholder="描述产品的材质、特点、用途…&#10;支持多行，每行将显示为一个段落。" />
          </div>
        </Section>

        {/* ── 产品图片 ── */}
        <Section title="产品图片" sub="拖拽可排序，第一张为主图。建议尺寸 1200×1600，JPG 格式">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            {images.map((img, i) => (
              <div key={img.url} style={{
                width: 120, height: 150, position: 'relative', overflow: 'hidden',
                border: i === 0 ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                borderRadius: 6, background: C.bg,
              }}>
                <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {i === 0 && (
                  <span style={{
                    position: 'absolute', top: 4, left: 4, background: C.gold,
                    color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 3,
                    letterSpacing: '.05em',
                  }}>主图</span>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', gap: 4, padding: 4,
                }}>
                  <SmallBtn onClick={() => moveImage(i, -1)} disabled={i === 0}>←</SmallBtn>
                  <SmallBtn onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}>→</SmallBtn>
                  <SmallBtn onClick={() => removeImage(i)} danger>✕</SmallBtn>
                </div>
              </div>
            ))}

            {/* 上传按钮 */}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
              width: 120, height: 150, border: `2px dashed ${C.border}`,
              borderRadius: 6, background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, color: C.muted, fontSize: 11, transition: 'border-color .2s',
            }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
              {uploading ? '上传中…' : '添加图片'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple
              onChange={handleImageUpload} style={{ display: 'none' }} />
          </div>
        </Section>

        {/* ── SKU 管理 ── */}
        <Section title="SKU / 规格" sub="每个颜色+尺寸组合为一个 SKU">
          {skus.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>暂无 SKU，点击下方按钮添加</p>
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['颜色', '色号', '宽度(mm)', '长度(m)', '价格(£)', '库存', '状态', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted,
                        fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skus.map((sku, i) => (
                    <tr key={sku.id || sku._temp_id} style={{ borderBottom: `1px solid #F0EDE8` }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input value={sku.colour} onChange={e => updateSku(i, 'colour', e.target.value)}
                          style={{ ...inp, padding: '6px 10px', fontSize: 12 }} placeholder="Warm Sand" />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="color" value={sku.colour_hex || '#D4C5B0'}
                            onChange={e => updateSku(i, 'colour_hex', e.target.value)}
                            style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }} />
                          <input value={sku.colour_hex || ''} onChange={e => updateSku(i, 'colour_hex', e.target.value)}
                            style={{ ...inp, padding: '6px 8px', fontSize: 11, width: 80, fontFamily: 'monospace' }} />
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={sku.width_mm || ''} onChange={e => updateSku(i, 'width_mm', e.target.value)}
                          style={{ ...inp, padding: '6px 10px', fontSize: 12, width: 70 }} placeholder="10" />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={sku.length_m || ''} onChange={e => updateSku(i, 'length_m', e.target.value)}
                          style={{ ...inp, padding: '6px 10px', fontSize: 12, width: 60 }} placeholder="10" />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" step="0.01" value={sku.price_gbp || ''} onChange={e => updateSku(i, 'price_gbp', e.target.value)}
                          style={{ ...inp, padding: '6px 10px', fontSize: 12, width: 80 }} placeholder="4.95" />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={sku.stock_qty || 0} onChange={e => updateSku(i, 'stock_qty', e.target.value)}
                          style={{ ...inp, padding: '6px 10px', fontSize: 12, width: 60 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => updateSku(i, 'is_active', !sku.is_active)} style={{
                          background: sku.is_active !== false ? C.green + '22' : C.red + '22',
                          color: sku.is_active !== false ? C.green : C.red,
                          border: 'none', borderRadius: 12, fontSize: 10, padding: '3px 10px', cursor: 'pointer',
                        }}>{sku.is_active !== false ? '启用' : '停用'}</button>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => removeSku(i)} style={{
                          background: C.light, border: 'none', borderRadius: 4,
                          color: C.red, fontSize: 11, padding: '4px 8px', cursor: 'pointer',
                        }}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={addSku} style={{
            padding: '10px 20px', background: C.white, border: `1px dashed ${C.border}`,
            borderRadius: 6, color: C.gold, fontSize: 12, cursor: 'pointer',
            letterSpacing: '.05em',
          }}>+ 添加 SKU</button>
        </Section>

        {/* 底部操作栏 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 0', borderTop: `1px solid ${C.border}`, marginTop: 32,
        }}>
          <div>
            {editing !== 'new' && (
              <button onClick={() => deleteProduct(editing)} style={{
                background: 'none', border: `1px solid ${C.red}`,
                borderRadius: 6, color: C.red, fontSize: 12, padding: '10px 20px', cursor: 'pointer',
              }}>删除此产品</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(null)} style={{
              padding: '10px 24px', background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.sub, fontSize: 12, cursor: 'pointer',
            }}>取消</button>
            <button onClick={saveProduct} disabled={saving} style={{
              padding: '10px 28px', background: C.gold, border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer',
              letterSpacing: '.08em', opacity: saving ? 0.7 : 1,
            }}>{saving ? '保存中…' : '保存产品'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  // 产品列表界面
  // ═══════════════════════════════════════════════════════
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>产品管理</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>共 {products.length} 个产品</p>
        </div>
        <button onClick={() => startEdit('new')} style={{
          background: C.gold, border: 'none', borderRadius: 8,
          color: '#fff', fontSize: 12, padding: '10px 24px', cursor: 'pointer',
          letterSpacing: '.08em',
        }}>+ 新建产品</button>
      </div>

      {/* 搜索和筛选 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索产品名称…"
          style={{ flex: 1, ...inp }} />
        <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ ...inp, width: 200 }}>
          <option value="all">全部系列</option>
          {COLLECTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* 产品列表 */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>加载中…</p> : filtered.length === 0 ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>暂无产品</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['', '产品名称', '系列', '图片', 'SKU数', '状态', '操作'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted,
                    fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const imgs = Array.isArray(p.images) ? p.images : []
                const isActive = p.is_active !== false && p.active !== false
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F0EDE8', cursor: 'pointer' }}
                    onClick={() => startEdit(p)}>
                    <td style={{ padding: '10px 16px', width: 56 }}>
                      {imgs[0] ? (
                        <img src={imgs[0]} style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                      ) : (
                        <div style={{ width: 40, height: 50, background: C.light, borderRadius: 4 }} />
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <p style={{ color: C.ink, fontSize: 13, fontWeight: 400 }}>{p.name}</p>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{p.slug}</p>
                    </td>
                    <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>
                      {collectionLabel(p.collection)}
                    </td>
                    <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>
                      {imgs.length} 张
                    </td>
                    <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>
                      {p.sku_count || '-'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: isActive ? C.green + '22' : C.red + '22',
                        color: isActive ? C.green : C.red,
                        fontSize: 11, padding: '3px 10px', borderRadius: 20,
                      }}>{isActive ? '上架' : '下架'}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => startEdit(p)} style={{
                          background: C.light, border: 'none', borderRadius: 4,
                          color: C.gold, fontSize: 11, padding: '5px 12px', cursor: 'pointer',
                        }}>编辑</button>
                        <button onClick={() => deleteProduct(p)} style={{
                          background: C.light, border: 'none', borderRadius: 4,
                          color: C.red, fontSize: 11, padding: '5px 12px', cursor: 'pointer',
                        }}>删除</button>
                      </div>
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

// ── 辅助组件 ──
function Section({ title, sub, children }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 28, marginBottom: 20,
    }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.ink, fontSize: 16, fontWeight: 400, marginBottom: sub ? 4 : 0 }}>{title}</h2>
        {sub && <p style={{ color: C.muted, fontSize: 11 }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Label({ children }) {
  return (
    <label style={{
      display: 'block', color: C.muted, fontSize: 10,
      letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6,
    }}>{children}</label>
  )
}

function SmallBtn({ onClick, disabled, danger, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 22, height: 22, border: 'none', borderRadius: 3,
      background: danger ? 'rgba(248,113,113,0.8)' : 'rgba(255,255,255,0.3)',
      color: '#fff', fontSize: 10, cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.3 : 1,
    }}>{children}</button>
  )
}
