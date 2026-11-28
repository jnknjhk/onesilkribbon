'use client'
// 商品：两个视图
//   · 商品列表 —— 找商品、上新、复制、删除
//   · 库存     —— 所有 SKU 平铺，直接改数字保存（只改库存，不碰商品的其它信息）
// 两个视图都由服务端分页、搜索和筛选，数据量增长后不会一次拉全表。
import { useUrlState } from '../../lib/url-state'
import { useListRequest } from '../../lib/use-list-request'
import { PageHeader, Tabs, ButtonLink, Button, Notice } from '../../ui'
import ProductList from './ProductList'
import StockView from './StockView'

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
