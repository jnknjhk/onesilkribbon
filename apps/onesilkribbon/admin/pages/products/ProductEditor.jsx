'use client'
// 新建 / 编辑商品。
//
// 保存时提交给 /api/admin/products 的数据和旧编辑页逐字段一致（包括 loaded_stock_qty、
// deletedSkuIds 和 colour/width_mm/length_m 的推算方式），只换了布局：
//   左边：名称描述 → 图片 → 选项 → SKU → 规格参数
//   右边：上下架 / 首页精选 → 系列和排序 → 网址 → 删除
//   底部：常驻保存栏，有没保存的修改会提示，离开页面前会问
//
// 纯数据逻辑在 product-editor-helpers.js，各区块在独立的卡片组件里；
// 这个文件只负责表单状态、保存/删除动作和页面布局。
//
// props:
//   product      'new' 或完整的商品（由 ProductEditorPage 按 id 取好）
//   initialSkus  这个商品的全部 SKU（含已停用的，走 service role 取，见下方注释）
//   onSaved(id)  保存成功
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import BatchSkuModal from './BatchSkuModal'
import { duplicateProduct } from './product-duplicate'
import ProductBasicCard from './ProductBasicCard'
import ProductImagesCard from './ProductImagesCard'
import ProductOptionsCard from './ProductOptionsCard'
import ProductSkuTable from './ProductSkuTable'
import ProductSpecificationsCard from './ProductSpecificationsCard'
import ProductSidebar from './ProductSidebar'
import {
  buildCombos, buildProductPayload, buildSkuRows, createSku,
  initialSpecifications, loadAttributeConfig, loadSku,
} from './product-editor-helpers'
import {
  PageHeader, Button, Badge, ConfirmDialog, Icon, useToast, useUnsavedWarning, styles as s, cx,
} from '../../ui'

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
  const [specifications, setSpecifications] = useState(() => initialSpecifications(product, isNew))
  const [attrConfig, setAttrConfig] = useState(() => (isNew ? [] : loadAttributeConfig(product.attribute_config)))
  const [skus, setSkus] = useState(() => (initialSkus || []).map(loadSku))
  const [deletedSkuIds, setDeletedSkuIds] = useState([])

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

  const attrNames = attrConfig.filter(a => a.name.trim()).map(a => a.name)
  const slugChanged = !isNew && product.slug && form.slug.trim() !== product.slug

  // 从商品里移除图片只是去掉引用，文件还在媒体库里（别处可能也在用）
  const moveImage = (i, d) => setImages(p => {
    const a = [...p]; const t = i + d
    if (t < 0 || t >= a.length) return a
    ;[a[i], a[t]] = [a[t], a[i]]
    return a
  })

  // ── SKU ────────────────────────────────────────────────────────────────
  function askGenerate() {
    const combos = buildCombos(attrConfig)
    if (!combos.length) { toast.error('请先添加至少一个选项，并填上选项值'); return }
    const keys = new Set(combos.map(c => JSON.stringify(c)))
    const dropping = skus.filter(k => !keys.has(JSON.stringify(k.attributes || {})))
    if (dropping.some(k => k.id)) setConfirm({ kind: 'regen', combos, dropping })
    else generateSkus(combos)
  }

  // 按选项生成全部组合：已有的组合原样保留（价格库存不变），新组合加一行，
  // 不在组合里的旧 SKU 标记删除（保存时有订单记录的会改为停用，不会真删）
  function generateSkus(combos) {
    const { next, removedIds } = buildSkuRows(skus, combos)
    if (removedIds.length) setDeletedSkuIds(p => [...p, ...removedIds])
    setSkus(next)
    toast.success(`已生成 ${next.length} 个 SKU 组合`)
  }

  function addSku() {
    setSkus(p => [...p, createSku(attrConfig)])
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
    const payload = buildProductPayload({
      isNew, product, form, images, attrConfig, specifications, skus, deletedSkuIds,
    })
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
    try { await onSaved(isNew ? res.id : product.id) } finally { setSaving(false) }
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
          <ProductBasicCard form={form} isNew={isNew} setForm={setForm} />
          <ProductImagesCard images={images} onMove={moveImage}
            onRemove={i => setImages(p => p.filter((_, j) => j !== i))}
            onAdd={urls => setImages(p => [...p, ...urls])} />
          <ProductOptionsCard attrConfig={attrConfig} setAttrConfig={setAttrConfig} onGenerate={askGenerate} />
          <ProductSkuTable skus={skus} attrNames={attrNames} hasAttributes={attrConfig.length > 0}
            deletedSkuIds={deletedSkuIds} onUpdate={updateSku} onUpdateAttr={updateSkuAttr}
            onRemove={removeSku} onAdd={addSku} onBatch={() => setBatchOpen(true)} />
          <ProductSpecificationsCard specifications={specifications} setSpecifications={setSpecifications} />
        </div>

        <ProductSidebar form={form} setForm={setForm} cfg={cfg} isNew={isNew} product={product}
          slugChanged={slugChanged} onDelete={() => setConfirm({ kind: 'delete' })} />
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
