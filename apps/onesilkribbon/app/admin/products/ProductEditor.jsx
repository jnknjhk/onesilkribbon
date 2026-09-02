'use client'
import { useState, useEffect } from 'react'
import MediaLibraryModal from '@osr/core/components/admin/MediaLibraryModal'
import BatchSkuModal from './BatchSkuModal'
import {
  C, inp, COLLECTIONS, slugify,
  Section, Label, SmallBtn, SkuImageUpload, AttrOptionImage,
} from './ui'

// 新建/编辑单个产品。表单状态全部由这个组件自己持有——
// 组件只在真正编辑时挂载，退出编辑就整个卸载，状态自然清空，
// 不需要父组件替它管理和重置。
//
// props:
//   product     — 'new' 或**完整**的产品对象（父组件按 id 取好后才挂载这个组件；
//                 列表接口返回的是裁剪过的产品，缺 description/specifications，
//                 直接拿来初始化表单会在保存时把这些字段清空）
//   initialSkus — 父组件取产品时顺手拿到的 SKU，省掉这里重复请求一次
//   onCancel    — 退出编辑（不保存）
//   onSaved     — 保存成功，父组件应重新拉列表
//   onDelete    — 删除当前产品（复用列表页的删除流程）
export default function ProductEditor({ product, initialSkus, onCancel, onSaved, onDelete }) {
  const isNew = product === 'new'

  const [form, setForm] = useState(() => isNew
    ? { name: '', slug: '', description: '', collection: 'fine-silk-ribbons', active: true }
    : {
        name: product.name || '', slug: product.slug || '',
        description: product.description || '',
        collection: product.collection || 'fine-silk-ribbons',
        active: product.is_active !== false,
        featured: product.is_featured || false,
        sort_order: product.sort_order || 0,
      })

  const [images, setImages] = useState(() => isNew
    ? []
    : (product.images || []).map(url => ({ url, isNew: false })))

  const [specifications, setSpecifications] = useState(() => {
    if (isNew) return [{ key: '', value: '' }]
    return Array.isArray(product.specifications) && product.specifications.length > 0
      ? product.specifications
      : [{ key: '', value: '' }]
  })

  const [attrConfig, setAttrConfig] = useState(() => isNew
    ? []
    : (product.attribute_config || []).map(a => ({
        ...a,
        options: (a.options || []).map(o => typeof o === 'string' ? { value: o, image: '' } : o),
      })))

  const [skus, setSkus] = useState(() =>
    (initialSkus || []).map(s => ({ ...s, attributes: s.attributes || {} })))
  const [skusLoading, setSkusLoading] = useState(!isNew && !initialSkus)
  const [deletedSkuIds, setDeletedSkuIds] = useState([])
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // 走 /api/admin/products?id=（service role）而不是匿名 supabase 客户端。
  // product_skus 上有 "is_active = true 才公开可见" 的 RLS 策略，用匿名 key 读
  // 会漏掉所有已停用的 SKU；而保存时后端会把"不在提交列表里"的 SKU 直接删除，
  // 于是那些没被加载出来的停用 SKU 会在下一次保存时被永久删掉。
  useEffect(() => {
    if (isNew || initialSkus) return
    let cancelled = false
    ;(async () => {
      setSkusLoading(true)
      try {
        const res = await fetch(`/api/admin/products?id=${product.id}`)
        const data = await res.json()
        if (cancelled) return
        setSkus((data.skus || []).map(s => ({ ...s, attributes: s.attributes || {} })))
      } catch {
        if (!cancelled) setSkus([])
      }
      if (!cancelled) setSkusLoading(false)
    })()
    return () => { cancelled = true }
  }, [isNew, product, initialSkus])

  function notify(text, ms = 3000) {
    setMsg(text)
    if (ms) setTimeout(() => setMsg(''), ms)
  }

  // ── 相册 ─────────────────────────────────────────────────────────────────
  // 从这个商品的相册里移除只是去掉引用——图片还留在媒体库里（可能别处也在用），
  // 真要删文件请去媒体库管理页
  function handleImagesPicked(urls) {
    setImages(p => [...p, ...urls.map(url => ({ url, isNew: true }))])
  }
  function removeImage(i) {
    setImages(p => p.filter((_, j) => j !== i))
  }
  function moveImage(i, d) {
    setImages(p => { const a = [...p]; const t = i + d; if (t < 0 || t >= a.length) return a; [a[i], a[t]] = [a[t], a[i]]; return a })
  }

  // ── 属性配置 ─────────────────────────────────────────────────────────────
  function addAttribute() {
    setAttrConfig(p => [...p, { name: '', options: [{ value: '', image: '' }] }])
  }
  function updateAttrName(i, name) {
    setAttrConfig(p => p.map((a, j) => j === i ? { ...a, name } : a))
  }
  function addAttrOption(i) {
    setAttrConfig(p => p.map((a, j) => j === i ? { ...a, options: [...a.options, { value: '', image: '' }] } : a))
  }
  function updateAttrOption(ai, oi, value) {
    setAttrConfig(p => p.map((a, j) => j === ai ? { ...a, options: a.options.map((o, k) => k === oi ? { ...(typeof o === 'object' ? o : { value: o, image: '' }), value } : o) } : a))
  }
  function updateAttrOptionImage(ai, oi, url) {
    setAttrConfig(p => p.map((a, j) => j === ai ? { ...a, options: a.options.map((o, k) => k === oi ? { ...(typeof o === 'object' ? o : { value: o, image: '' }), image: url } : o) } : a))
  }
  function removeAttrOption(ai, oi) {
    setAttrConfig(p => p.map((a, j) => j === ai ? { ...a, options: a.options.filter((_, k) => k !== oi) } : a))
  }
  function removeAttribute(i) {
    setAttrConfig(p => p.filter((_, j) => j !== i))
  }

  // ── SKU ──────────────────────────────────────────────────────────────────
  function generateSkus() {
    const validAttrs = attrConfig.filter(a => a.name.trim() && a.options.some(o => (typeof o === 'object' ? o.value : o).trim()))
    if (validAttrs.length === 0) { setMsg('请先添加至少一个属性和选项'); return }

    const combos = validAttrs.reduce((acc, attr) => {
      const opts = attr.options.map(o => typeof o === 'object' ? o.value : o).filter(o => o.trim())
      if (acc.length === 0) return opts.map(o => ({ [attr.name]: o }))
      const result = []
      for (const combo of acc) {
        for (const opt of opts) result.push({ ...combo, [attr.name]: opt })
      }
      return result
    }, [])

    const existingMap = {}
    skus.forEach(s => { existingMap[JSON.stringify(s.attributes || {})] = s })

    const newSkus = combos.map(attrs => {
      const existing = existingMap[JSON.stringify(attrs)]
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

    const newKeys = new Set(combos.map(attrs => JSON.stringify(attrs)))
    const toDelete = skus.filter(s => s.id && !newKeys.has(JSON.stringify(s.attributes || {})))
    if (toDelete.length > 0) setDeletedSkuIds(p => [...p, ...toDelete.map(s => s.id)])

    setSkus(newSkus)
    notify(`已生成 ${newSkus.length} 个 SKU 组合`)
  }

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

  // ── 保存 ─────────────────────────────────────────────────────────────────
  async function saveProduct() {
    if (!form.name.trim()) { setMsg('请填写产品名称'); return }
    if (!form.slug.trim()) { setMsg('请填写 URL Slug'); return }
    setSaving(true); setMsg('')

    try {
      const cleanConfig = attrConfig
        .filter(a => a.name.trim())
        .map(a => ({
          name: a.name.trim(),
          options: a.options
            .filter(o => (typeof o === 'object' ? o.value : o).trim())
            .map(o => typeof o === 'object' ? o : { value: o, image: '' }),
        }))

      const payload = {
        action: isNew ? 'create' : 'update',
        product: {
          ...(isNew ? {} : { id: product.id }),
          name: form.name.trim(), slug: form.slug.trim(),
          description: form.description.trim(), collection: form.collection,
          is_active: form.active, is_featured: form.featured || false,
          sort_order: parseInt(form.sort_order) || 0,
          images: images.map(img => img.url),
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
          price_gbp: s.price_gbp, stock_qty: s.stock_qty, is_active: s.is_active, images: s.images || [],
        })),
        deletedSkuIds,
      }

      const res = await fetch('/api/admin/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.error) { setMsg('保存失败：' + result.error); setSaving(false); return }

      setMsg('保存成功 ✓')
      setTimeout(onSaved, 800)
    } catch (err) {
      setMsg('保存失败：' + err.message)
    }
    setSaving(false)
  }

  const attrNames = attrConfig.filter(a => a.name.trim()).map(a => a.name)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 12, cursor: 'pointer', marginBottom: 8, padding: 0, display: 'block' }}>← 返回产品列表</button>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300 }}>{isNew ? '新建产品' : `编辑：${form.name}`}</h1>
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
        <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Label>产品名称 *</Label>
            <input value={form.name} onChange={e => { const n = e.target.value; setForm(p => ({ ...p, name: n, slug: isNew ? slugify(n) : p.slug })) }} style={inp} placeholder="Mulberry Silk Ribbon" />
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
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginTop:10 }}>
              <input type="checkbox" checked={form.featured || false} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} />
              <span style={{ fontSize:12, color:C.sub }}>首页精选（显示在首页推荐区域）</span>
            </label>
          </div>
          <div>
            <Label>排序权重</Label>
            <input type="number" value={form.sort_order || 0}
              onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
              placeholder="0" style={{ ...inp, width:'100%' }} />
            <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>数字越小越靠前，0为默认</p>
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
              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {i === 0 && <span style={{ position: 'absolute', top: 4, left: 4, background: C.gold, color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 3 }}>主图</span>}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', gap: 4, padding: 4 }}>
                <SmallBtn onClick={() => moveImage(i, -1)} disabled={i === 0}>←</SmallBtn>
                <SmallBtn onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}>→</SmallBtn>
                <SmallBtn onClick={() => removeImage(i)} danger>✕</SmallBtn>
              </div>
            </div>
          ))}
          <button onClick={() => setShowGalleryPicker(true)} style={{
            width: 120, height: 120, border: `2px dashed ${C.border}`, borderRadius: 6, background: 'transparent',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted, fontSize: 11,
          }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
            选择图片
          </button>
          <MediaLibraryModal
            open={showGalleryPicker}
            multiple
            namespace="product"
            onClose={() => setShowGalleryPicker(false)}
            onSelect={handleImagesPicked}
          />
        </div>
      </Section>

      {/* 属性配置 */}
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
              {attr.options.map((opt, oi) => {
                const optObj = typeof opt === 'object' ? opt : { value: opt, image: '' }
                return (
                  <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={optObj.value} onChange={e => updateAttrOption(ai, oi, e.target.value)}
                      style={{ ...inp, background: C.white, flex: 1 }} placeholder={`选项 ${oi + 1}`} />
                    <AttrOptionImage
                      image={optObj.image}
                      onChange={url => updateAttrOptionImage(ai, oi, url)}
                    />
                    <button onClick={() => removeAttrOption(ai, oi)} disabled={attr.options.length <= 1}
                      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, color: C.red, fontSize: 12, padding: '0 10px', height: 36, cursor: attr.options.length <= 1 ? 'default' : 'pointer', opacity: attr.options.length <= 1 ? 0.3 : 1 }}>✕</button>
                  </div>
                )
              })}
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

      <BatchSkuModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        skus={skus}
        attrNames={attrNames}
        onApply={setSkus}
        onNotify={notify}
      />

      {/* SKU 列表 */}
      <Section title="SKU / 库存" sub={`共 ${skus.length} 个 SKU。可自动生成，也可手动添加`}>
        {skus.length > 0 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={() => setBatchOpen(true)}
              style={{ padding:'8px 18px', background:C.gold+'22', border:`1px solid ${C.gold}`, borderRadius:6, color:C.gold, fontSize:12, cursor:'pointer' }}>
              ⚡ 批量调整价格/库存
            </button>
          </div>
        )}
        {skusLoading ? (
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>加载 SKU 中…</p>
        ) : skus.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>暂无 SKU。请先添加属性后点击&quot;自动生成 SKU 组合&quot;，或手动添加</p>
        ) : (
          <div className="admin-table-scroll" style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: attrNames.length * 120 + 300 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {attrNames.map(n => (
                    <th key={n} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>{n}</th>
                  ))}
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: 10, letterSpacing: '.08em' }}>图片</th>
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
                      <SkuImageUpload
                        images={sku.images || []}
                        onChange={imgs => updateSku(i, 'images', imgs)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input type="number" step="0.01" value={sku.price_gbp || ''} onChange={e => updateSku(i, 'price_gbp', e.target.value)}
                        style={{ ...inp, padding: '6px 10px', fontSize: 12, width: 80 }} placeholder="0.00" />
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
          {!isNew && (
            <button onClick={() => onDelete(product)} style={{ background: 'none', border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, fontSize: 12, padding: '10px 20px', cursor: 'pointer' }}>删除此产品</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '10px 24px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, fontSize: 12, cursor: 'pointer' }}>取消</button>
          <button onClick={saveProduct} disabled={saving} style={{ padding: '10px 28px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '保存中…' : '保存产品'}
          </button>
        </div>
      </div>
    </div>
  )
}
