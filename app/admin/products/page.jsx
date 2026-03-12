'use client'
import { useState, useEffect, useRef } from 'react'

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
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', light: '#EDE9E4',
  red: '#f87171', green: '#4ade80',
}

const inp = {
  width: '100%', padding: '10px 14px', background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Jost', sans-serif",
}

function slugify(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterCol, setFilterCol] = useState('all')
  const [skuMap, setSkuMap] = useState({})

  // 产品表单
  const [form, setForm] = useState({ name: '', slug: '', description: '', collection: 'fine-silk-ribbons', active: true })
  const [images, setImages] = useState([])
  const [specifications, setSpecifications] = useState([{ key: '', value: '' }])
  const [uploading, setUploading] = useState(false)
  // 属性配置: [{name: '颜色', options: ['Warm Sand', 'Blush']}, {name: '宽度', options: ['7mm','10mm']}]
  const [attrConfig, setAttrConfig] = useState([])
  // SKU 列表: [{id?, attributes: {颜色:'Warm Sand', 宽度:'7mm'}, colour_hex, price_gbp, stock_qty, is_active}]
  const [skus, setSkus] = useState([])
  const [deletedSkuIds, setDeletedSkuIds] = useState([])
  const [deletedImageUrls, setDeletedImageUrls] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])

      // 同时加载所有SKU库存
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      const { data: skuData } = await sb.from('product_skus').select('id, product_id, colour, colour_hex, attributes, stock_qty, price_gbp').order('product_id')
      const map = {}
      for (const sku of (skuData || [])) {
        if (!map[sku.product_id]) map[sku.product_id] = []
        map[sku.product_id].push(sku)
      }
      setSkuMap(map)
    } catch { setProducts([]) }
    setLoading(false)
  }

  async function startEdit(product) {
    if (product === 'new') {
      setForm({ name: '', slug: '', description: '', collection: 'fine-silk-ribbons', active: true })
      setImages([]); setAttrConfig([]); setSkus([])
      setDeletedSkuIds([]); setDeletedImageUrls([])
      setSpecifications([{ key: '', value: '' }])
      setEditing('new')
    } else {
      setForm({
        name: product.name || '', slug: product.slug || '',
        description: product.description || '',
        collection: product.collection || 'fine-silk-ribbons',
        active: product.is_active !== false,
      })
      setImages((product.images || []).map(url => ({ url, isNew: false })))
      setAttrConfig(product.attribute_config || [])
      setSpecifications(
        Array.isArray(product.specifications) && product.specifications.length > 0
          ? product.specifications
          : [{ key: '', value: '' }]
      )

      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      const { data: skuData } = await sb.from('product_skus').select('*').eq('product_id', product.id).order('created_at')
      setSkus((skuData || []).map(s => ({
        ...s,
        attributes: s.attributes || {},
      })))
      setDeletedSkuIds([]); setDeletedImageUrls([])
      setEditing(product)
    }
    setMsg('')
  }

  // ── 图片 ──
  async function handleImageUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    const pid = editing === 'new' ? 'temp-' + Date.now() : editing.id
    for (const file of files) {
      const fd = new FormData(); fd.append('file', file); fd.append('productId', pid)
      try {
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.url) setImages(p => [...p, { url: data.url, isNew: true }])
        else setMsg('上传失败：' + (data.error || ''))
      } catch (err) { setMsg('上传失败：' + err.message) }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  function removeImage(i) {
    const img = images[i]
    if (img && !img.isNew) setDeletedImageUrls(p => [...p, img.url])
    else if (img?.isNew) fetch('/api/admin/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: img.url }) }).catch(() => {})
    setImages(p => p.filter((_, j) => j !== i))
  }
  function moveImage(i, d) {
    setImages(p => { const a = [...p]; const t = i + d; if (t < 0 || t >= a.length) return a; [a[i], a[t]] = [a[t], a[i]]; return a })
  }

  // ── 属性配置 ──
  function addAttribute() {
    setAttrConfig(p => [...p, { name: '', options: [''] }])
  }
  function updateAttrName(i, name) {
    setAttrConfig(p => p.map((a, j) => j === i ? { ...a, name } : a))
  }
  function addAttrOption(i) {
    setAttrConfig(p => p.map((a, j) => j === i ? { ...a, options: [...a.options, ''] } : a))
  }
  function updateAttrOption(ai, oi, value) {
    setAttrConfig(p => p.map((a, j) => j === ai ? { ...a, options: a.options.map((o, k) => k === oi ? value : o) } : a))
  }
  function removeAttrOption(ai, oi) {
    setAttrConfig(p => p.map((a, j) => j === ai ? { ...a, options: a.options.filter((_, k) => k !== oi) } : a))
  }
  function removeAttribute(i) {
    setAttrConfig(p => p.filter((_, j) => j !== i))
  }

  // ── 批量生成 SKU ──
  function generateSkus() {
    const validAttrs = attrConfig.filter(a => a.name.trim() && a.options.some(o => o.trim()))
    if (validAttrs.length === 0) { setMsg('请先添加至少一个属性和选项'); return }

    // 生成所有组合
    const combos = validAttrs.reduce((acc, attr) => {
      const opts = attr.options.filter(o => o.trim())
      if (acc.length === 0) return opts.map(o => ({ [attr.name]: o }))
      const result = []
      for (const combo of acc) {
        for (const opt of opts) {
          result.push({ ...combo, [attr.name]: opt })
        }
      }
      return result
    }, [])

    // 保留已有 SKU 的价格和库存，合并新组合
    const existingMap = {}
    skus.forEach(s => {
      const key = JSON.stringify(s.attributes || {})
      existingMap[key] = s
    })

    const newSkus = combos.map(attrs => {
      const key = JSON.stringify(attrs)
      const existing = existingMap[key]
      if (existing) return existing
      return {
        _temp_id: Date.now() + Math.random(),
        attributes: attrs,
        colour_hex: '#D4C5B0',
        price_gbp: '',
        stock_qty: 0,
        is_active: true,
      }
    })

    // 把不在新组合里的旧SKU加入待删除列表
    const newKeys = new Set(combos.map(attrs => JSON.stringify(attrs)))
    const toDelete = skus.filter(s => s.id && !newKeys.has(JSON.stringify(s.attributes || {})))
    if (toDelete.length > 0) {
      setDeletedSkuIds(p => [...p, ...toDelete.map(s => s.id)])
    }

    setSkus(newSkus)
    setMsg(`已生成 ${newSkus.length} 个 SKU 组合`)
    setTimeout(() => setMsg(''), 3000)
  }

  // ── SKU 操作 ──
  function addSkuManual() {
    const attrs = {}
    attrConfig.forEach(a => { if (a.name.trim()) attrs[a.name] = '' })
    setSkus(p => [...p, { _temp_id: Date.now(), attributes: attrs, colour_hex: '#D4C5B0', price_gbp: '', stock_qty: 0, is_active: true }])
  }
  function updateSku(i, field, value) {
    setSkus(p => p.map((s, j) => j === i ? { ...s, [field]: value } : s))
  }
  function updateSkuAttr(i, attrName, value) {
    setSkus(p => p.map((s, j) => j === i ? { ...s, attributes: { ...s.attributes, [attrName]: value } } : s))
  }
  function removeSku(i) {
    const sku = skus[i]
    if (sku.id) setDeletedSkuIds(p => [...p, sku.id])
    setSkus(p => p.filter((_, j) => j !== i))
  }

  // ── 保存 ──
  async function saveProduct() {
    if (!form.name.trim()) { setMsg('请填写产品名称'); return }
    if (!form.slug.trim()) { setMsg('请填写 URL Slug'); return }
    setSaving(true); setMsg('')

    try {
      const cleanConfig = attrConfig
        .filter(a => a.name.trim())
        .map(a => ({ name: a.name.trim(), options: a.options.filter(o => o.trim()) }))

      const payload = {
        action: editing === 'new' ? 'create' : 'update',
        product: {
          ...(editing !== 'new' ? { id: editing.id } : {}),
          name: form.name.trim(), slug: form.slug.trim(),
          description: form.description.trim(), collection: form.collection,
          is_active: form.active, images: images.map(img => img.url),
          attribute_config: cleanConfig,
          specifications: specifications.filter(s => s.key.trim() && s.value.trim()),
        },
        skus: skus.map(s => ({
          ...(s.id ? { id: s.id } : {}),
          attributes: s.attributes || {},
          colour: s.attributes?.['颜色'] || s.attributes?.['Colour'] || s.attributes?.['Color'] || s.colour || '默认',
          colour_hex: s.colour_hex || '#D4C5B0',
          width_mm: s.attributes?.['宽度'] ? parseInt(s.attributes['宽度']) : (s.attributes?.['Width'] ? parseInt(s.attributes['Width']) : s.width_mm || null),
          length_m: s.attributes?.['长度'] ? parseInt(s.attributes['长度']) : (s.attributes?.['Length'] ? parseInt(s.attributes['Length']) : s.length_m || null),
          price_gbp: s.price_gbp, stock_qty: s.stock_qty, is_active: s.is_active,
        })),
        deletedSkuIds,
      }

      const res = await fetch('/api/admin/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.error) { setMsg('保存失败：' + result.error); setSaving(false); return }

      for (const url of deletedImageUrls) {
        await fetch('/api/admin/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).catch(() => {})
      }

      setMsg('保存成功 ✓')
      setTimeout(() => { setEditing(null); loadProducts() }, 800)
    } catch (err) { setMsg('保存失败：' + err.message) }
    setSaving(false)
  }

  async function deleteProduct(product) {
    if (!confirm(`确定删除「${product.name}」？`)) return
    await fetch('/api/admin/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', product: { id: product.id } }),
    })
    if (product.images) {
      for (const url of product.images) {
        await fetch('/api/admin/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).catch(() => {})
      }
    }
    if (editing) setEditing(null)
    loadProducts()
  }

  const filtered = products.filter(p => {
    const ms = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.slug?.toLowerCase().includes(search.toLowerCase())
    const mc = filterCol === 'all' || p.collection === filterCol
    return ms && mc
  })

  const collectionLabel = v => COLLECTIONS.find(c => c.value === v)?.label || v

  // ═══════════════════════════════
  // 编辑界面
  // ═══════════════════════════════
  if (editing !== null) {
    const attrNames = attrConfig.filter(a => a.name.trim()).map(a => a.name)

    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 顶部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 12, cursor: 'pointer', marginBottom: 8, padding: 0, display: 'block' }}>← 返回产品列表</button>
            <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300 }}>{editing === 'new' ? '新建产品' : `编辑：${form.name}`}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {msg && <span style={{ color: msg.includes('✓') ? C.green : C.red, fontSize: 12 }}>{msg}</span>}
            <button onClick={saveProduct} disabled={saving} style={{ padding: '10px 28px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? '保存中…' : '保存产品'}
            </button>
          </div>
        </div>

        {/* 基本信息 */}
        <Section title="基本信息">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label>产品名称 *</Label>
              <input value={form.name} onChange={e => { const n = e.target.value; setForm(p => ({ ...p, name: n, slug: editing === 'new' ? slugify(n) : p.slug })) }} style={inp} placeholder="Mulberry Silk Ribbon" />
            </div>
            <div>
              <Label>URL Slug *</Label>
              <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} style={inp} placeholder="mulberry-silk-ribbon" />
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
              placeholder="描述产品的材质、特点、用途…" />
          </div>
        </Section>

        {/* 规格参数 */}
        <Section title="规格参数" sub="在商品详情页的 Description 标签中显示，每行一项（如 Material / 100% Pure Mulberry Silk）">
          {specifications.map((spec, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <input
                value={spec.key} placeholder="名称（如 Material）"
                onChange={e => setSpecifications(p => p.map((s, j) => j === i ? { ...s, key: e.target.value } : s))}
                style={inp} />
              <input
                value={spec.value} placeholder="内容（如 100% Pure Mulberry Silk）"
                onChange={e => setSpecifications(p => p.map((s, j) => j === i ? { ...s, value: e.target.value } : s))}
                style={inp} />
              <button
                onClick={() => setSpecifications(p => p.filter((_, j) => j !== i))}
                disabled={specifications.length <= 1}
                style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, color: C.red, fontSize: 12, padding: '8px 12px', cursor: specifications.length <= 1 ? 'default' : 'pointer', opacity: specifications.length <= 1 ? 0.3 : 1 }}>✕</button>
            </div>
          ))}
          <button onClick={() => setSpecifications(p => [...p, { key: '', value: '' }])}
            style={{ padding: '8px 18px', background: C.white, border: `1px dashed ${C.border}`, borderRadius: 6, color: C.gold, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
            + 添加规格项
          </button>
        </Section>

        {/* 图片 */}
        <Section title="产品图片" sub="第一张为主图。建议 1200×1200，JPG 格式">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            {images.map((img, i) => (
              <div key={img.url} style={{ width: 120, height: 120, position: 'relative', overflow: 'hidden', border: i === 0 ? `2px solid ${C.gold}` : `1px solid ${C.border}`, borderRadius: 6, background: C.bg }}>
                <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {i === 0 && <span style={{ position: 'absolute', top: 4, left: 4, background: C.gold, color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 3 }}>主图</span>}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', gap: 4, padding: 4 }}>
                  <SmallBtn onClick={() => moveImage(i, -1)} disabled={i === 0}>←</SmallBtn>
                  <SmallBtn onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}>→</SmallBtn>
                  <SmallBtn onClick={() => removeImage(i)} danger>✕</SmallBtn>
                </div>
              </div>
            ))}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
              width: 120, height: 120, border: `2px dashed ${C.border}`, borderRadius: 6, background: 'transparent',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted, fontSize: 11,
            }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
              {uploading ? '上传中…' : '添加图片'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
          </div>
        </Section>

        {/* ════════ 属性配置 ════════ */}
        <Section title="产品属性" sub="定义这个产品有哪些可选属性（如颜色、宽度、长度），客户在详情页通过下拉框选择">
          {attrConfig.map((attr, ai) => (
            <div key={ai} style={{ background: C.bg, borderRadius: 8, padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <Label>属性名称</Label>
                  <input value={attr.name} onChange={e => updateAttrName(ai, e.target.value)}
                    style={{ ...inp, background: C.white }} placeholder="例：颜色、宽度、长度" />
                </div>
                <button onClick={() => removeAttribute(ai)} style={{ background: 'none', border: `1px solid ${C.red}`, borderRadius: 4, color: C.red, fontSize: 11, padding: '6px 12px', cursor: 'pointer', marginTop: 20 }}>
                  删除属性
                </button>
              </div>
              <Label>选项值（每个一行）</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attr.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: 8 }}>
                    <input value={opt} onChange={e => updateAttrOption(ai, oi, e.target.value)}
                      style={{ ...inp, background: C.white, flex: 1 }} placeholder={`选项 ${oi + 1}`} />
                    <button onClick={() => removeAttrOption(ai, oi)} disabled={attr.options.length <= 1}
                      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, color: C.red, fontSize: 12, padding: '0 10px', cursor: attr.options.length <= 1 ? 'default' : 'pointer', opacity: attr.options.length <= 1 ? 0.3 : 1 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => addAttrOption(ai)} style={{ marginTop: 8, background: 'none', border: `1px dashed ${C.border}`, borderRadius: 4, color: C.gold, fontSize: 11, padding: '6px 14px', cursor: 'pointer' }}>
                + 添加选项
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={addAttribute} style={{ padding: '10px 20px', background: C.white, border: `1px dashed ${C.border}`, borderRadius: 6, color: C.gold, fontSize: 12, cursor: 'pointer' }}>
              + 添加属性
            </button>
            {attrConfig.length > 0 && (
              <button onClick={generateSkus} style={{ padding: '10px 20px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                自动生成 SKU 组合
              </button>
            )}
          </div>
        </Section>

        {/* ════════ SKU 列表 ════════ */}
        <Section title="SKU / 库存" sub={`共 ${skus.length} 个 SKU。可自动生成，也可手动添加`}>
          {skus.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>暂无 SKU。请先添加属性后点击"自动生成 SKU 组合"，或手动添加</p>
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: attrNames.length * 120 + 400 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {attrNames.map(n => (
                      <th key={n} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>{n}</th>
                    ))}
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em' }}>色号</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em' }}>价格(£)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em' }}>库存</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em' }}>状态</th>
                    <th style={{ padding: '10px 12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {skus.map((sku, i) => (
                    <tr key={sku.id || sku._temp_id || i} style={{ borderBottom: '1px solid #F0EDE8' }}>
                      {attrNames.map(n => (
                        <td key={n} style={{ padding: '8px 12px' }}>
                          <input value={sku.attributes?.[n] || ''} onChange={e => updateSkuAttr(i, n, e.target.value)}
                            style={{ ...inp, padding: '6px 10px', fontSize: 12 }} />
                        </td>
                      ))}
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="color" value={sku.colour_hex || '#D4C5B0'} onChange={e => updateSku(i, 'colour_hex', e.target.value)}
                            style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }} />
                          <input value={sku.colour_hex || ''} onChange={e => updateSku(i, 'colour_hex', e.target.value)}
                            style={{ ...inp, padding: '6px 8px', fontSize: 11, width: 80, fontFamily: 'monospace' }} />
                        </div>
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
                        <button onClick={() => removeSku(i)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.red, fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={addSkuManual} style={{ padding: '10px 20px', background: C.white, border: `1px dashed ${C.border}`, borderRadius: 6, color: C.gold, fontSize: 12, cursor: 'pointer' }}>
            + 手动添加 SKU
          </button>
        </Section>

        {/* 底部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0', borderTop: `1px solid ${C.border}`, marginTop: 32 }}>
          <div>
            {editing !== 'new' && (
              <button onClick={() => deleteProduct(editing)} style={{ background: 'none', border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, fontSize: 12, padding: '10px 20px', cursor: 'pointer' }}>删除此产品</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(null)} style={{ padding: '10px 24px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, fontSize: 12, cursor: 'pointer' }}>取消</button>
            <button onClick={saveProduct} disabled={saving} style={{ padding: '10px 28px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? '保存中…' : '保存产品'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════
  // 列表界面
  // ═══════════════════════════════
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>产品管理</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>共 {products.length} 个产品</p>
        </div>
        <button onClick={() => startEdit('new')} style={{ background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '10px 24px', cursor: 'pointer' }}>+ 新建产品</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索产品名称…" style={{ flex: 1, ...inp }} />
        <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ ...inp, width: 200 }}>
          <option value="all">全部系列</option>
          {COLLECTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>加载中…</p> : filtered.length === 0 ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>暂无产品</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['', '产品名称', '系列', '图片', '属性', '库存', '状态', '操作'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const imgs = Array.isArray(p.images) ? p.images : []
                const isActive = p.is_active !== false
                const attrs = p.attribute_config || []
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F0EDE8', cursor: 'pointer' }} onClick={() => startEdit(p)}>
                    <td style={{ padding: '10px 16px', width: 56 }}>
                      {imgs[0] ? <img src={imgs[0]} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, display: 'block' }} /> : <div style={{ width: 40, height: 40, background: C.light, borderRadius: 4 }} />}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <p style={{ color: C.ink, fontSize: 13, fontWeight: 400 }}>{p.name}</p>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{p.slug}</p>
                    </td>
                    <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{collectionLabel(p.collection)}</td>
                    <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{imgs.length} 张</td>
                    <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{attrs.length > 0 ? attrs.map(a => a.name).join('、') : '-'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {(() => {
                        const skus = skuMap[p.id] || []
                        if (skus.length === 0) return <span style={{ color: C.muted, fontSize: 12 }}>—</span>
                        const hasOut = skus.some(k => (k.stock_qty || 0) === 0)
                        const hasLow = skus.some(k => (k.stock_qty || 0) > 0 && (k.stock_qty || 0) < 10)
                        if (hasOut) return <span style={{ fontSize: 11, color: C.red, background: C.red + '18', padding: '3px 8px', borderRadius: 10 }}>⚠ 有SKU售罄</span>
                        if (hasLow) return <span style={{ fontSize: 11, color: '#facc15', background: '#facc1518', padding: '3px 8px', borderRadius: 10 }}>⚠ 有SKU库存不足</span>
                        return <span style={{ fontSize: 11, color: C.green }}>正常</span>
                      })()}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: isActive ? C.green + '22' : C.red + '22', color: isActive ? C.green : C.red, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{isActive ? '上架' : '下架'}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => startEdit(p)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.gold, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>编辑</button>
                        <button onClick={() => deleteProduct(p)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.red, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>删除</button>
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
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.ink, fontSize: 16, fontWeight: 400, marginBottom: sub ? 4 : 0 }}>{title}</h2>
        {sub && <p style={{ color: C.muted, fontSize: 11 }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}
function Label({ children }) {
  return <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</label>
}
function SmallBtn({ onClick, disabled, danger, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 22, height: 22, border: 'none', borderRadius: 3,
      background: danger ? 'rgba(248,113,113,0.8)' : 'rgba(255,255,255,0.3)',
      color: '#fff', fontSize: 10, cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1,
    }}>{children}</button>
  )
}
