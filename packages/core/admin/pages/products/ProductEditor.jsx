'use client'
// 新建 / 编辑商品。
//
// 保存时提交给 /api/admin/products 的数据和旧编辑页逐字段一致（包括 loaded_stock_qty、
// deletedSkuIds 和 colour/width_mm/length_m 的推算方式），只换了布局：
//   左边：名称描述 → 图片 → 选项 → SKU → 规格参数
//   右边：上下架 / 首页精选 → 系列和排序 → 网址 → 删除
//   底部：常驻保存栏，有没保存的修改会提示，离开页面前会问
//
// props:
//   product      'new' 或完整的商品（由 ProductEditorPage 按 id 取好）
//   initialSkus  这个商品的全部 SKU（含已停用的，走 service role 取，见下方注释）
//   onSaved(id, res)  保存成功；res 里带着保存后的最新商品和 SKU（编辑已有商品时）
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { slugify } from '../../lib/format'
import MediaPicker from '../../MediaPicker'
import BatchSkuModal from './BatchSkuModal'
import { duplicateProduct } from './ProductsPage'
import {
  PageHeader, Card, Field, Input, Textarea, Select, Segmented, Checkbox, Button, Badge, Notice,
  ConfirmDialog, EmptyState, Icon, useToast, useUnsavedWarning, Img, styles as s, cx,
} from '../../ui'

const optObj = o => (typeof o === 'object' && o !== null ? o : { value: o, image: '' })

// 旧编辑页对 SKU 的处理：加载时记下库存（_loaded_stock_qty），保存时交给后端判断"库存是不是被改过"
const loadSku = k => ({ ...k, attributes: k.attributes || {}, _loaded_stock_qty: k.stock_qty })

export default function ProductEditor({ product, initialSkus, onSaved }) {
  const cfg = useAdminConfig()
  const router = useRouter()
  const toast = useToast()
  const isNew = product === 'new'
  const defaultCollection = cfg.collections[0]?.value || ''

  const [form, setForm] = useState(() => isNew
    ? { name: '', slug: '', description: '', collection: defaultCollection, active: true }
    : {
        name: product.name || '', slug: product.slug || '',
        description: product.description || '',
        collection: product.collection || defaultCollection,
        active: product.is_active !== false,
        featured: product.is_featured || false,
        sort_order: product.sort_order || 0,
      })
  const [images, setImages] = useState(() => (isNew ? [] : product.images || []))
  const [specifications, setSpecifications] = useState(() =>
    !isNew && Array.isArray(product.specifications) && product.specifications.length > 0
      ? product.specifications
      : [{ key: '', value: '' }])
  const [attrConfig, setAttrConfig] = useState(() => isNew ? [] : (product.attribute_config || []).map(a => ({
    ...a, options: (a.options || []).map(optObj),
  })))
  const [skus, setSkus] = useState(() => (initialSkus || []).map(loadSku))
  const [deletedSkuIds, setDeletedSkuIds] = useState([])

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // { kind: 'delete'|'regen'|'price'|'duplicate', ... }
  const [busy, setBusy] = useState(false)

  // 有没有没保存的修改：和打开时的快照比
  const snapshot = JSON.stringify([form, images, specifications, attrConfig, skus, deletedSkuIds])
  const baseline = useRef(snapshot)
  const dirty = snapshot !== baseline.current
  useUnsavedWarning(dirty && !saving)

  const setF = patch => setForm(p => ({ ...p, ...patch }))
  const attrNames = attrConfig.filter(a => a.name.trim()).map(a => a.name)
  const slugChanged = !isNew && product.slug && form.slug.trim() !== product.slug

  // ── 图片 ────────────────────────────────────────────────────────────────
  // 从商品里移除图片只是去掉引用，文件还在媒体库里（别处可能也在用）
  const moveImage = (i, d) => setImages(p => {
    const a = [...p]; const t = i + d
    if (t < 0 || t >= a.length) return a
    ;[a[i], a[t]] = [a[t], a[i]]
    return a
  })

  // ── 选项（属性） ────────────────────────────────────────────────────────
  const updateAttr = (i, fn) => setAttrConfig(p => p.map((a, j) => (j === i ? fn(a) : a)))
  const updateOpt = (ai, oi, patch) => updateAttr(ai, a => ({ ...a, options: a.options.map((o, k) => (k === oi ? { ...optObj(o), ...patch } : o)) }))

  // ── SKU ────────────────────────────────────────────────────────────────
  function buildCombos() {
    const valid = attrConfig.filter(a => a.name.trim() && a.options.some(o => optObj(o).value.trim()))
    return valid.reduce((acc, attr) => {
      const opts = attr.options.map(o => optObj(o).value).filter(o => o.trim())
      if (acc.length === 0) return opts.map(o => ({ [attr.name]: o }))
      const out = []
      for (const combo of acc) for (const opt of opts) out.push({ ...combo, [attr.name]: opt })
      return out
    }, [])
  }

  function askGenerate() {
    const combos = buildCombos()
    if (!combos.length) { toast.error('请先添加至少一个选项，并填上选项值'); return }
    const keys = new Set(combos.map(c => JSON.stringify(c)))
    const dropping = skus.filter(k => !keys.has(JSON.stringify(k.attributes || {})))
    if (dropping.some(k => k.id)) setConfirm({ kind: 'regen', combos, dropping })
    else generateSkus(combos)
  }

  // 按选项生成全部组合：已有的组合原样保留（价格库存不变），新组合加一行，
  // 不在组合里的旧 SKU 标记删除（保存时有订单记录的会改为停用，不会真删）
  function generateSkus(combos) {
    const existing = {}
    skus.forEach(k => { existing[JSON.stringify(k.attributes || {})] = k })
    const next = combos.map(attrs => existing[JSON.stringify(attrs)] || {
      _temp_id: Date.now() + Math.random(), attributes: attrs, colour_hex: '#D4C5B0', price_gbp: '', stock_qty: 0, is_active: true,
    })
    const keys = new Set(combos.map(c => JSON.stringify(c)))
    const drop = skus.filter(k => k.id && !keys.has(JSON.stringify(k.attributes || {})))
    if (drop.length) setDeletedSkuIds(p => [...p, ...drop.map(k => k.id)])
    setSkus(next)
    toast.success(`已生成 ${next.length} 个 SKU 组合`)
  }

  function addSku() {
    const attrs = {}
    attrConfig.forEach(a => { if (a.name.trim()) attrs[a.name] = '' })
    setSkus(p => [...p, { _temp_id: Date.now(), attributes: attrs, colour_hex: '#D4C5B0', price_gbp: '', stock_qty: 0, is_active: true }])
  }
  const updateSku = (i, patch) => setSkus(p => p.map((k, j) => (j === i ? { ...k, ...patch } : k)))
  const updateSkuAttr = (i, name, value) => setSkus(p => p.map((k, j) => (j === i ? { ...k, attributes: { ...k.attributes, [name]: value } } : k)))
  function removeSku(i) {
    const sku = skus[i]
    if (sku.id) setDeletedSkuIds(p => [...p, sku.id])
    setSkus(p => p.filter((_, j) => j !== i))
  }

  // ── 保存 ────────────────────────────────────────────────────────────────
  function trySave() {
    setError('')
    if (!form.name.trim()) { setError('请填写商品名称'); return }
    if (!form.slug.trim()) { setError('请填写网址'); return }
    const noPrice = skus.filter(k => k.is_active !== false && !(parseFloat(k.price_gbp) > 0))
    if (noPrice.length) { setConfirm({ kind: 'price', count: noPrice.length }); return }
    save()
  }

  async function save() {
    setConfirm(null)
    setSaving(true); setError('')
    const cleanConfig = attrConfig
      .filter(a => a.name.trim())
      .map(a => ({ name: a.name.trim(), options: a.options.filter(o => optObj(o).value.trim()).map(optObj) }))
    const payload = {
      action: isNew ? 'create' : 'update',
      product: {
        ...(isNew ? {} : { id: product.id }),
        name: form.name.trim(), slug: form.slug.trim(),
        description: form.description.trim(), collection: form.collection,
        is_active: form.active, is_featured: form.featured || false,
        sort_order: parseInt(form.sort_order) || 0,
        images,
        attribute_config: cleanConfig,
        specifications: specifications.filter(x => x.key.trim() && x.value.trim()),
      },
      skus: skus.map(k => ({
        ...(k.id ? { id: k.id, loaded_stock_qty: k._loaded_stock_qty } : {}),
        attributes: k.attributes || {},
        colour: k.attributes?.['颜色'] || k.attributes?.['Colour'] || k.attributes?.['Color'] || k.colour || '默认',
        colour_hex: k.colour_hex || '#D4C5B0',
        width_mm: k.attributes?.['宽度'] ? parseInt(k.attributes['宽度']) : (k.attributes?.['Width'] ? parseInt(k.attributes['Width']) : k.width_mm || null),
        length_m: k.attributes?.['长度'] ? parseInt(k.attributes['长度']) : (k.attributes?.['Length'] ? parseInt(k.attributes['Length']) : k.length_m || null),
        price_gbp: k.price_gbp, stock_qty: k.stock_qty, is_active: k.is_active, images: k.images || [],
      })),
      deletedSkuIds,
    }
    let res
    try {
      res = await api('/api/admin/products', { method: 'POST', body: payload })
      baseline.current = snapshot // 已保存，离开不再提示
      if (res.deactivated) toast.success(`已保存。${res.deactivated} 个删掉的 SKU 有历史订单，改为停用保留`)
      else toast.success('已保存')
    } catch (e) {
      setError('保存失败：' + e.message)
      setSaving(false)
      return
    }
    // 保存后重新从数据库取一遍再显示：新加的 SKU 拿到 id，库存基准也更新成最新值，
    // 否则接着再改再保存，新 SKU 会被重复插入一次
    try { await onSaved(isNew ? res.id : product.id, res) } finally { setSaving(false) }
  }

  async function doDelete() {
    setBusy(true)
    try {
      const res = await api('/api/admin/products', { method: 'POST', body: { action: 'delete', product: { id: product.id } } })
      baseline.current = snapshot
      toast.success(res.softDeleted ? res.message : '商品已删除')
      router.push('/admin/products')
    } catch (e) { toast.error('删除失败：' + e.message); setBusy(false); setConfirm(null) }
  }

  async function doDuplicate() {
    setBusy(true)
    try {
      const id = await duplicateProduct(product.id)
      toast.success('已复制，复制出来的商品默认是下架状态')
      setConfirm(null); setBusy(false)
      router.push(`/admin/products/${id}`)
    } catch (e) { toast.error('复制失败：' + e.message); setBusy(false); setConfirm(null) }
  }

  const totalStock = useMemo(() => skus.filter(k => k.is_active !== false).reduce((n, k) => n + (parseInt(k.stock_qty) || 0), 0), [skus])

  return (
    <div>
      <PageHeader
        back="/admin/products"
        title={isNew ? '新建商品' : (form.name || '未命名商品')}
        subtitle={!isNew && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={form.active ? 'success' : 'neutral'}>{form.active ? '上架中' : '已下架'}</Badge>
          <span>{skus.length} 个 SKU · 库存共 {totalStock}</span>
        </span>}
        actions={!isNew && <>
          <a className={cx(s.btn, s.btn_secondary)} href={`${cfg.siteUrl}/collections/${product.collection}/${product.slug}`} target="_blank" rel="noreferrer">
            <Icon name="external" size={16} /><span>在网站上查看</span>
          </a>
          <Button icon="copy" onClick={() => setConfirm({ kind: 'duplicate' })}>复制</Button>
        </>}
      />

      <div className={s.split}>
        <div className={s.stack}>
          <Card title="基本信息">
            <div className={s.stack}>
              <Field label="商品名称" required>
                <Input value={form.name} placeholder="Mulberry Silk Ribbon"
                  onChange={e => { const n = e.target.value; setForm(p => ({ ...p, name: n, slug: isNew ? slugify(n) : p.slug })) }} />
              </Field>
              <Field label="商品描述" hint="显示在商品详情页，写材质、特点、用途">
                <Textarea rows={6} value={form.description} onChange={e => setF({ description: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title="商品图片" subtitle="第一张是主图，用箭头调整顺序。建议 1200×1200">
            <div className={s.imgGrid}>
              {images.map((url, i) => (
                <div key={`${i}-${url}`} className={cx(s.imgTile, i === 0 && s.imgTileMain)}>
                  <Img src={url} width={160} />
                  {i === 0 && <span className={s.imgTileTag}><Badge tone="brand">主图</Badge></span>}
                  <div className={s.imgTileTools}>
                    <button type="button" className={s.imgTileBtn} disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label="前移"><Icon name="chevronLeft" size={15} /></button>
                    <button type="button" className={s.imgTileBtn} disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} aria-label="后移"><Icon name="chevronRight" size={15} /></button>
                    <button type="button" className={s.imgTileBtn} onClick={() => setImages(p => p.filter((_, j) => j !== i))} aria-label="移除"><Icon name="trash" size={15} /></button>
                  </div>
                </div>
              ))}
              <button type="button" className={s.imgAdd} onClick={() => setGalleryOpen(true)}>
                <Icon name="plus" size={22} /><span>添加图片</span>
              </button>
            </div>
            <MediaPicker open={galleryOpen} multiple namespace="product" onClose={() => setGalleryOpen(false)}
              onSelect={urls => setImages(p => [...p, ...urls])} />
          </Card>

          <Card title="选项" subtitle="顾客在商品页可以选的项目，比如颜色、宽度、长度"
            actions={attrConfig.length > 0 && <Button size="sm" variant="primary" icon="layers" onClick={askGenerate}>按选项生成 SKU</Button>}>
            <div className={s.stack}>
              {attrConfig.length === 0 && <div className={s.muted} style={{ fontSize: 14 }}>还没有选项。只有一种规格的商品可以不加选项，直接在下面添加一个 SKU。</div>}
              {attrConfig.map((attr, ai) => (
                <div key={ai} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
                    <Field label="选项名称" style={{ flex: 1 }}>
                      <Input value={attr.name} placeholder="例如：颜色、宽度、长度" onChange={e => updateAttr(ai, a => ({ ...a, name: e.target.value }))} />
                    </Field>
                    <Button variant="dangerGhost" icon="trash" onClick={() => setAttrConfig(p => p.filter((_, j) => j !== ai))}>删除选项</Button>
                  </div>
                  <div className={s.fieldLabel} style={{ marginBottom: 6 }}>选项值</div>
                  <div className={s.stack} style={{ gap: 8 }}>
                    {attr.options.map((opt, oi) => (
                      <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Input value={optObj(opt).value} placeholder={`选项值 ${oi + 1}`} onChange={e => updateOpt(ai, oi, { value: e.target.value })} />
                        <OptionImage image={optObj(opt).image} onChange={url => updateOpt(ai, oi, { image: url })} />
                        <Button iconOnly variant="ghost" icon="x" aria-label="删除这个值" disabled={attr.options.length <= 1}
                          onClick={() => updateAttr(ai, a => ({ ...a, options: a.options.filter((_, k) => k !== oi) }))} />
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" icon="plus" style={{ marginTop: 8 }}
                    onClick={() => updateAttr(ai, a => ({ ...a, options: [...a.options, { value: '', image: '' }] }))}>添加值</Button>
                </div>
              ))}
              <div><Button icon="plus" onClick={() => setAttrConfig(p => [...p, { name: '', options: [{ value: '', image: '' }] }])}>添加选项</Button></div>
            </div>
          </Card>

          <Card title="SKU · 价格与库存" subtitle={`${skus.length} 个 SKU。每个 SKU 是一种可以单独下单的规格`} padded={false}
            actions={skus.length > 0 && <Button size="sm" icon="edit" onClick={() => setBatchOpen(true)}>批量调整</Button>}>
            {skus.length === 0 ? (
              <EmptyState icon="layers" title="还没有 SKU" text={attrConfig.length ? '点上面的"按选项生成 SKU"，或手动添加' : '手动添加一个 SKU，填上价格和库存'} />
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      {attrNames.map(n => <th key={n}>{n}</th>)}
                      <th>图片</th><th style={{ width: 110 }}>价格 (£)</th><th style={{ width: 100 }}>库存</th><th>状态</th><th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map((k, i) => {
                      const stockChanged = k.id && (parseInt(k.stock_qty, 10) || 0) !== (parseInt(k._loaded_stock_qty, 10) || 0)
                      return (
                        <tr key={k.id || k._temp_id || i} style={k.is_active === false ? { opacity: .6 } : undefined}>
                          {attrNames.map(n => (
                            <td key={n} data-label={n}>
                              <Input size="sm" value={k.attributes?.[n] || ''} onChange={e => updateSkuAttr(i, n, e.target.value)} style={{ minWidth: 90 }} />
                            </td>
                          ))}
                          <td data-label="图片"><SkuImages images={k.images || []} onChange={imgs => updateSku(i, { images: imgs })} /></td>
                          <td data-label="价格 (£)">
                            <Input size="sm" type="number" step="0.01" min="0" value={k.price_gbp ?? ''} placeholder="0.00"
                              onChange={e => updateSku(i, { price_gbp: e.target.value })} style={{ width: 96 }} />
                          </td>
                          <td data-label="库存">
                            <div>
                              <Input size="sm" type="number" min="0" value={k.stock_qty ?? ''} onChange={e => updateSku(i, { stock_qty: e.target.value })} style={{ width: 80 }} />
                              {stockChanged && <div className={s.cellSub}>原来 {k._loaded_stock_qty ?? 0}</div>}
                            </div>
                          </td>
                          <td data-label="状态">
                            <Segmented value={k.is_active !== false} onChange={v => updateSku(i, { is_active: v })}
                              options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} />
                          </td>
                          <td>
                            <Button iconOnly size="sm" variant="ghost" icon="trash" aria-label="删除 SKU" onClick={() => removeSku(i)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ padding: '12px 18px', borderTop: skus.length ? '1px solid var(--border)' : 0 }}>
              <Button size="sm" icon="plus" onClick={addSku}>手动添加 SKU</Button>
              {deletedSkuIds.length > 0 && <span className={s.muted} style={{ fontSize: 13, marginLeft: 12 }}>保存后删除 {new Set(deletedSkuIds).size} 个 SKU（有订单记录的改为停用）</span>}
            </div>
          </Card>

          <Card title="规格参数" subtitle="显示在商品详情页的 Description 标签里，比如 Material / 100% Pure Mulberry Silk">
            <div className={s.stack} style={{ gap: 8 }}>
              {specifications.map((spec, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr) auto', gap: 8 }}>
                  <Input value={spec.key} placeholder="名称，如 Material"
                    onChange={e => setSpecifications(p => p.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <Input value={spec.value} placeholder="内容，如 100% Pure Mulberry Silk"
                    onChange={e => setSpecifications(p => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <Button iconOnly variant="ghost" icon="x" aria-label="删除这一项" disabled={specifications.length <= 1}
                    onClick={() => setSpecifications(p => p.filter((_, j) => j !== i))} />
                </div>
              ))}
              <div><Button size="sm" variant="ghost" icon="plus" onClick={() => setSpecifications(p => [...p, { key: '', value: '' }])}>添加一项</Button></div>
            </div>
          </Card>
        </div>

        <div className={s.stack}>
          <Card title="状态">
            <div className={s.stack}>
              <Segmented value={form.active} onChange={v => setF({ active: v })}
                options={[{ value: true, label: '上架' }, { value: false, label: '下架' }]} />
              <Checkbox checked={form.featured} onChange={v => setF({ featured: v })}>首页精选（显示在首页推荐区）</Checkbox>
            </div>
          </Card>
          <Card title="分类">
            <div className={s.stack}>
              <Field label="所属系列">
                <Select value={form.collection} onChange={e => setF({ collection: e.target.value })}>
                  {!cfg.collections.some(c => c.value === form.collection) && <option value={form.collection}>{form.collection}</option>}
                  {cfg.collections.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="排序" hint="数字越小越靠前，默认 0">
                <Input type="number" value={form.sort_order ?? 0} onChange={e => setF({ sort_order: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="网址">
            <Field label="商品网址" required hint={isNew ? '根据商品名称自动生成，一般不用改' : undefined}>
              <Input value={form.slug} onChange={e => setF({ slug: e.target.value })} className={s.mono} />
            </Field>
            <div className={s.cellSub} style={{ marginTop: 6, wordBreak: 'break-all' }}>{cfg.siteUrl.replace(/^https?:\/\//, '')}/collections/{form.collection}/{form.slug || '…'}</div>
            {slugChanged && <Notice tone="info" style={{ marginTop: 10 }}>改网址后，旧链接（…/{product.slug}）会自动跳转到新网址，已经分享出去的链接不会失效。</Notice>}
          </Card>
          {!isNew && (
            <Card title="删除商品">
              <p className={s.muted} style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6 }}>有订单记录的商品不会真的删除，会改为下架，订单历史保留。</p>
              <Button variant="dangerGhost" icon="trash" onClick={() => setConfirm({ kind: 'delete' })}>删除这个商品</Button>
            </Card>
          )}
        </div>
      </div>

      <div className={s.saveBar}>
        <span className={s.saveBarMsg}>
          {error ? <span className={s.textDanger}>{error}</span>
            : dirty ? <><span className={s.dirtyDot} />有修改还没保存</>
              : isNew ? '填好后点保存' : '没有未保存的修改'}
        </span>
        <span style={{ flex: 1 }} />
        <Button variant="primary" icon="check" loading={saving} onClick={trySave} disabled={!isNew && !dirty}>保存</Button>
      </div>

      <BatchSkuModal open={batchOpen} onClose={() => setBatchOpen(false)} skus={skus} attrNames={attrNames}
        onApply={(next, msg) => { setSkus(next); toast.success(msg) }} />

      <ConfirmDialog open={confirm?.kind === 'regen'} title="重新生成 SKU"
        message={`按现在的选项重新生成后，有 ${confirm?.dropping?.filter(k => k.id).length || 0} 个现有 SKU 不在新组合里，保存时会被删除（有订单记录的改为停用）。确定吗？`}
        danger confirmLabel="生成" onCancel={() => setConfirm(null)}
        onConfirm={() => { generateSkus(confirm.combos); setConfirm(null) }} />
      <ConfirmDialog open={confirm?.kind === 'price'} title="有 SKU 没填价格"
        message={`有 ${confirm?.count} 个启用中的 SKU 价格是 0 或没填，顾客会看到 £0.00。确定照这样保存吗？`}
        confirmLabel="仍然保存" onCancel={() => setConfirm(null)} onConfirm={save} />
      <ConfirmDialog open={confirm?.kind === 'delete'} title="删除商品" danger confirmLabel="删除" loading={busy}
        message={`确定删除「${product?.name || ''}」吗？没有订单记录的商品删除后无法恢复；有订单记录的会改为下架。`}
        onCancel={() => setConfirm(null)} onConfirm={doDelete} />
      <ConfirmDialog open={confirm?.kind === 'duplicate'} title="复制商品" confirmLabel="复制" loading={busy}
        message={dirty ? '复制的是已保存的版本，当前没保存的修改不会带过去。' : '会复制出一个内容相同、处于下架状态的新商品。'}
        onCancel={() => setConfirm(null)} onConfirm={doDuplicate} />
    </div>
  )
}

// SKU 图片（可多张）
function SkuImages({ images, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', maxWidth: 170 }}>
      {images.map((url, i) => (
        <span key={`${i}-${url}`} style={{ position: 'relative' }}>
          <Img src={url} width={36} className={s.thumb} style={{ width: 36, height: 36 }} />
          <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="移除图片"
            style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', border: 0, background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="x" size={10} strokeWidth={3} />
          </button>
        </span>
      ))}
      <button type="button" className={s.imgAdd} style={{ width: 36, height: 36 }} onClick={() => setOpen(true)} aria-label="添加 SKU 图片"><Icon name="plus" size={16} /></button>
      <MediaPicker open={open} multiple namespace="product" onClose={() => setOpen(false)} onSelect={urls => onChange([...images, ...urls])} />
    </div>
  )
}

// 选项值的配图（单张）
function OptionImage({ image, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {image ? (
        <span style={{ position: 'relative', flexShrink: 0 }}>
          <Img src={image} width={38} className={s.thumb} style={{ width: 38, height: 38, cursor: 'pointer' }} onClick={() => setOpen(true)} title="点击更换" />
          <button type="button" onClick={() => onChange('')} aria-label="移除配图"
            style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', border: 0, background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="x" size={10} strokeWidth={3} />
          </button>
        </span>
      ) : (
        <button type="button" className={s.imgAdd} style={{ width: 38, height: 38, flexShrink: 0 }} onClick={() => setOpen(true)} title="给这个值配一张图" aria-label="添加配图">
          <Icon name="image" size={16} />
        </button>
      )}
      <MediaPicker open={open} namespace="product" onClose={() => setOpen(false)} onSelect={urls => onChange(urls[0])} />
    </>
  )
}
