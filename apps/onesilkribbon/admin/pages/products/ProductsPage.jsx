'use client'
// 商品：两个视图
//   · 商品列表 —— 找商品、上新、复制、删除
//   · 库存     —— 所有 SKU 平铺，直接改数字保存（只改库存，不碰商品的其它信息）
// 两个视图都由服务端分页、搜索和筛选，数据量增长后不会一次拉全表。
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminConfig, collectionLabel } from '../../config'
import { api } from '../../lib/api'
import { parseStockQuantity } from '../../lib/stock-quantity'
import { money } from '../../lib/format'
import { useUrlState } from '../../lib/url-state'
import { useListRequest } from '../../lib/use-list-request'
import {
  PageHeader, Card, Tabs, SearchInput, Select, DataTable, Pager, Badge, Button, ButtonLink, Input,
  ConfirmDialog, EmptyState, Icon, Notice, useToast, styles as s,
} from '../../ui'

const DEFAULTS = { view: 'list', q: '', collection: '', status: '', filter: '', page: '1' }

export default function ProductsPage() {
  const [get, set] = useUrlState(DEFAULTS)
  const view = get('view') === 'stock' ? 'stock' : 'list'
  const page = parseInt(get('page'), 10) || 1
  const q = get('q')
  const collection = get('collection')
  const status = get('status')
  const filter = get('filter')

  const params = new URLSearchParams({ view, page: String(page) })
  if (q) params.set('q', q)
  if (view === 'stock') {
    if (filter) params.set('filter', filter)
  } else {
    if (collection) params.set('collection', collection)
    if (status) params.set('status', status)
  }
  const { data, setData, loading, error, reload } = useListRequest(`/api/admin/products?${params.toString()}`)

  return (
    <div>
      <PageHeader title="商品" subtitle={`共 ${data?.total ?? '…'} ${view === 'stock' ? '个 SKU' : '个商品'}`}
        actions={<ButtonLink href="/admin/products/new" variant="primary" icon="plus">新建商品</ButtonLink>} />
      <Tabs value={view} onChange={v => set({ view: v, page: 1, filter: '' })}
        tabs={[{ key: 'list', label: '商品列表' }, { key: 'stock', label: '库存' }]} />
      {error && (
        <Notice tone="danger" style={{ marginBottom: 14 }}>
          加载失败：{error} <Button size="sm" onClick={reload}>重试</Button>
        </Notice>
      )}
      {view === 'stock'
        ? <StockView data={data} setData={setData} loading={loading} reload={reload} get={get} set={set} />
        : <ProductList data={data} loading={loading} reload={reload} get={get} set={set} />}
    </div>
  )
}

function ProductList({ data, loading, reload, get, set }) {
  const cfg = useAdminConfig()
  const router = useRouter()
  const toast = useToast()
  const q = get('q').toLowerCase()
  const collection = get('collection')
  const status = get('status')
  const page = parseInt(get('page'), 10) || 1
  const [search, setSearch] = useState(get('q'))
  const [confirm, setConfirm] = useState(null) // { type: 'delete'|'duplicate', product }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (search !== get('q')) set({ q: search, page: 1 }) }, 250)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const products = data?.products || []
  const hasFilters = !!(q || collection || status)

  async function runConfirm() {
    const { type, product } = confirm
    setBusy(true)
    try {
      if (type === 'delete') {
        const res = await api('/api/admin/products', { method: 'POST', body: { action: 'delete', product: { id: product.id } } })
        toast.success(res.softDeleted ? res.message : '商品已删除')
      } else {
        const id = await duplicateProduct(product.id)
        toast.success('已复制，复制出来的商品默认是下架状态')
        router.push(`/admin/products/${id}`)
      }
      setConfirm(null)
      reload()
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <>
      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索商品名称或网址" style={{ flex: 1, minWidth: 220 }} />
        <Select value={collection} onChange={e => set({ collection: e.target.value, page: 1 })} style={{ width: 210 }}>
          <option value="">全部系列</option>
          {cfg.collections.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <Select value={status} onChange={e => set({ status: e.target.value, page: 1 })} style={{ width: 130 }}>
          <option value="">全部状态</option>
          <option value="active">上架中</option>
          <option value="inactive">已下架</option>
        </Select>
      </div>
      <Card padded={false}>
        <DataTable
          loading={loading && !data}
          rows={products}
          onRowClick={p => router.push(`/admin/products/${p.id}`)}
          empty={<EmptyState icon="tag" title={hasFilters ? '没有符合条件的商品' : '还没有商品'}
            action={!hasFilters && <ButtonLink href="/admin/products/new" variant="primary" icon="plus">新建第一个商品</ButtonLink>} />}
          columns={[
            { key: 'name', header: '商品', primary: true, render: p => (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                {p.images?.[0] ? <img src={p.images[0]} alt="" className={s.thumb} /> : <span className={s.thumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}><Icon name="image" size={18} /></span>}
                <div style={{ minWidth: 0 }}>
                  <div className={s.cellMain}>{p.name}{p.is_featured && <Icon name="star" size={13} style={{ marginLeft: 6, color: 'var(--brand)', verticalAlign: '-1px' }} />}</div>
                  <div className={s.cellSub}>{collectionLabel(cfg, p.collection)}</div>
                </div>
              </div>
            ) },
            { key: 'price', header: '价格', render: p => (
              p.min_price == null ? <span className={s.muted}>—</span>
                : <span className={s.num}>{p.min_price === p.max_price ? money(p.min_price) : `${money(p.min_price)} – ${money(p.max_price)}`}</span>
            ) },
            { key: 'stock', header: '库存', render: p => (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className={s.num}>{p.stock_total}</span>
                <span className={s.muted} style={{ fontSize: 12 }}>/ {p.sku_count} 个 SKU</span>
                {p.out_count > 0 && <Badge tone="danger">{p.out_count} 个售罄</Badge>}
                {p.low_count > 0 && <Badge tone="warning">{p.low_count} 个偏低</Badge>}
              </span>
            ) },
            { key: 'status', header: '状态', render: p => p.is_active !== false ? <Badge tone="success">上架中</Badge> : <Badge>已下架</Badge> },
            { key: 'actions', header: '', align: 'right', render: p => (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <Button size="sm" variant="ghost" iconOnly icon="copy" title="复制" aria-label="复制" onClick={() => setConfirm({ type: 'duplicate', product: p })} />
                <Button size="sm" variant="ghost" iconOnly icon="trash" title="删除" aria-label="删除" onClick={() => setConfirm({ type: 'delete', product: p })} />
              </span>
            ) },
          ]}
        />
        <Pager page={page} totalPages={data?.totalPages} total={data?.total} unit="个" onChange={p => set({ page: p })} />
      </Card>

      <ConfirmDialog open={!!confirm} loading={busy}
        title={confirm?.type === 'delete' ? '删除商品' : '复制商品'}
        danger={confirm?.type === 'delete'}
        confirmLabel={confirm?.type === 'delete' ? '删除' : '复制'}
        message={confirm?.type === 'delete'
          ? `确定删除「${confirm.product.name}」？有历史订单的商品不会真的删除，只会下架，订单记录保留。`
          : confirm ? `复制「${confirm.product.name}」为一个新商品（包括图片、规格和全部 SKU），复制出来的默认下架。` : ''}
        onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
    </>
  )
}

// 复制：读完整商品 + 全部 SKU（含已停用的），新建一个下架的副本
export async function duplicateProduct(id) {
  const { product: p, skus } = await api(`/api/admin/products?id=${id}`)
  const res = await api('/api/admin/products', { method: 'POST', body: {
    action: 'create',
    product: {
      name: `${p.name} (Copy)`,
      slug: `${p.slug}-copy-${Date.now().toString().slice(-4)}`,
      description: p.description,
      collection: p.collection,
      is_active: false,
      is_featured: false,
      sort_order: p.sort_order || 0,
      images: p.images || [],
      attribute_config: p.attribute_config || [],
      specifications: p.specifications || [],
    },
    // 以前复制时没带 colour / width_mm / length_m，属性里没写这几项的 SKU 复制出来就丢了
    skus: (skus || []).map(k => ({
      attributes: k.attributes, colour: k.colour, colour_hex: k.colour_hex,
      width_mm: k.width_mm, length_m: k.length_m,
      price_gbp: k.price_gbp, stock_qty: k.stock_qty, is_active: k.is_active, images: k.images || [],
    })),
  } })
  if (!res.id) throw new Error(res.error || '复制失败')
  return res.id
}

function skuLabel(k) {
  const attrs = Object.entries(k.attributes || {}).map(([, v]) => v).filter(Boolean)
  return attrs.length ? attrs.join(' · ') : (k.colour && k.colour !== '默认' ? k.colour : '默认规格')
}

function StockView({ data, setData, loading, reload, get, set }) {
  const toast = useToast()
  const filter = get('filter') // '' | 'low' | 'out'
  const q = get('q')
  const page = parseInt(get('page'), 10) || 1
  const [search, setSearch] = useState(q)
  const [edits, setEdits] = useState({})        // skuId -> 新数字（字符串）
  const [conflicts, setConflicts] = useState({}) // skuId -> 提示
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (search !== get('q')) set({ q: search, page: 1 }) }, 250)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const skus = data?.skus || []
  const threshold = data?.lowStockThreshold ?? 3

  const dirtyIds = Object.keys(edits).filter(id => {
    const k = skus.find(x => x.id === id)
    return k && String(edits[id]) !== String(k.stock_qty ?? 0)
  })

  async function save() {
    const updates = dirtyIds.map(id => {
      const k = skus.find(x => x.id === id)
      return { id, stock_qty: parseStockQuantity(edits[id]), expected: k.stock_qty ?? null }
    })
    if (updates.some(u => u.stock_qty === null)) { toast.error('库存必须是 0 或正整数'); return }
    setSaving(true)
    try {
      const { results } = await api('/api/admin/stock', { method: 'PATCH', body: { updates } })
      const saved = {}
      const conf = {}
      for (const r of results) {
        if (r.ok) saved[r.id] = r.stock_qty
        else if (r.conflict) { saved[r.id] = r.current; conf[r.id] = r.error }
        else conf[r.id] = r.error
      }
      setData(d => d ? {
        ...d,
        skus: d.skus.map(k => (saved[k.id] !== undefined ? { ...k, stock_qty: saved[k.id] } : k)),
      } : d)
      setEdits(e => { const n = { ...e }; for (const r of results) if (r.ok) delete n[r.id]; return n })
      setConflicts(conf)
      const ok = results.filter(r => r.ok).length
      if (ok) toast.success(`已保存 ${ok} 个 SKU 的库存`)
      if (Object.keys(conf).length) toast.error(`${Object.keys(conf).length} 个 SKU 没保存：库存在你编辑期间被订单改过，请看红字里的最新数字，确认后再保存`)
      else reload()
    } catch (e) { toast.error('保存失败：' + e.message) }
    setSaving(false)
  }

  return (
    <>
      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索商品、颜色或 SKU 编号" style={{ flex: 1, minWidth: 220 }} />
        <Select value={filter} onChange={e => set({ filter: e.target.value, page: 1 })} style={{ width: 170 }}>
          <option value="">全部 SKU</option>
          <option value="low">库存 ≤ {threshold}（在售）</option>
          <option value="out">已售罄（在售）</option>
        </Select>
        <Button variant="primary" icon="check" disabled={!dirtyIds.length} loading={saving} onClick={save}>
          {dirtyIds.length ? `保存 ${dirtyIds.length} 处修改` : '没有修改'}
        </Button>
      </div>
      <Notice tone="info" style={{ marginBottom: 14 }}>
        这里只改库存数字。保存时如果某个 SKU 的库存在你打开页面之后被订单改过，那一行不会被覆盖，会显示最新数字让你确认。
      </Notice>
      <Card padded={false}>
        <DataTable
          loading={loading && !data}
          rows={skus}
          rowClassName={k => dirtyIds.includes(k.id) && s.rowSelected}
          empty={<EmptyState icon="layers" title={filter || q ? '没有符合条件的 SKU' : '没有 SKU'} />}
          columns={[
            { key: 'name', header: '商品 / 规格', primary: true, render: k => {
              const p = k.products || {}
              return (
                <>
                  <div className={s.cellMain}>{p.name || '—'}</div>
                  <div className={s.cellSub}>{skuLabel(k)}{p.is_active === false ? ' · 商品已下架' : ''}{k.is_active === false ? ' · 此规格已停用' : ''}</div>
                </>
              )
            } },
            { key: 'price', header: '价格', render: k => <span className={s.num}>{money(k.price_gbp)}</span> },
            { key: 'state', header: '状态', render: k => {
              const qty = k.stock_qty || 0
              if (k.is_active === false) return <Badge>停用</Badge>
              if (qty <= 0) return <Badge tone="danger">售罄</Badge>
              if (qty <= threshold) return <Badge tone="warning">偏低</Badge>
              return <Badge tone="success">充足</Badge>
            } },
            { key: 'qty', header: '库存', align: 'right', render: k => (
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <Input size="sm" type="number" min={0} step={1} className={s.num}
                  style={{ width: 96, textAlign: 'right' }}
                  value={edits[k.id] ?? String(k.stock_qty ?? 0)}
                  onChange={e => { setEdits(m => ({ ...m, [k.id]: e.target.value })); setConflicts(c => { const n = { ...c }; delete n[k.id]; return n }) }} />
                {conflicts[k.id] && <span className={s.textDanger} style={{ fontSize: 12, maxWidth: 220, textAlign: 'right' }}>{conflicts[k.id]}</span>}
              </span>
            ) },
            { key: 'open', header: '', align: 'right', render: k => (
              <ButtonLink size="sm" variant="ghost" href={`/admin/products/${k.product_id}`}>编辑商品</ButtonLink>
            ) },
          ]}
        />
        <Pager page={page} totalPages={data?.totalPages} total={data?.total} unit="个 SKU" onChange={p => set({ page: p })} />
      </Card>
    </>
  )
}
