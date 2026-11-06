'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminConfig, collectionLabel } from '../../config'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { duplicateProduct } from './product-duplicate'
import {
  Card, SearchInput, Select, DataTable, Pager, Badge, Button, ButtonLink, ConfirmDialog,
  EmptyState, Icon, useToast, styles as s,
} from '../../ui'

export default function ProductList({ data, loading, reload, get, set }) {
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
