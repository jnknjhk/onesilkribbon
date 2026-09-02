'use client'
import { useState, useEffect } from 'react'
import { ConfirmDialog, InfoDialog } from '@osr/core/components/admin/ConfirmDialog'
import ProductList from './ProductList'
import ProductEditor from './ProductEditor'

// 产品管理入口。这一层只负责三件事：拉产品列表、在列表/编辑视图之间切换、
// 处理删除和复制这两个跨视图的操作（列表页和编辑页都能触发删除）。
// 表单本身的状态在 ProductEditor 里，列表的搜索分页在 ProductList 里。
export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [skuMap, setSkuMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)          // null | 'new' | product
  const [confirmState, setConfirmState] = useState(null) // { type: 'delete'|'duplicate', product }
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [infoState, setInfoState] = useState(null)       // { title, message }

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      // 走 /api/admin/products（service role），不用匿名 client 直查 product_skus——
      // 匿名 key 受 "is_active=true 才公开可见" 的 RLS 限制，会看不到已下架 SKU 的库存/价格
      const res = await fetch('/api/admin/products')
      const data = await res.json()
      setProducts(Array.isArray(data.products) ? data.products : [])

      const map = {}
      for (const sku of (data.skus || [])) {
        if (!map[sku.product_id]) map[sku.product_id] = []
        map[sku.product_id].push(sku)
      }
      setSkuMap(map)
    } catch { setProducts([]) }
    setLoading(false)
  }

  async function handleConfirm() {
    if (!confirmState) return
    setConfirmLoading(true)
    if (confirmState.type === 'delete') await deleteProduct(confirmState.product)
    else await duplicateProduct(confirmState.product)
    setConfirmLoading(false)
    setConfirmState(null)
  }

  async function deleteProduct(product) {
    const res = await fetch('/api/admin/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', product: { id: product.id } }),
    })
    const data = await res.json()

    if (data.softDeleted) setInfoState({ title: '已下架', message: data.message })
    // 硬删除的商品：图片留在媒体库里不动——可能是复用来的图，删商品不该顺手删图片，
    // 真要清理未使用的图，去媒体库管理页处理
    setEditing(null)
    loadProducts()
  }

  async function duplicateProduct(product) {
    try {
      // 走 /api/admin/products?id=（service role）：产品下若有已停用的 SKU，
      // 匿名 key 的 RLS 会读不到，复制出来的新产品会悄悄漏掉那些 SKU
      const res = await fetch(`/api/admin/products?id=${product.id}`)
      const { product: fullProduct, skus: fullSkus } = await res.json()

      const createRes = await fetch('/api/admin/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          product: {
            name: `${fullProduct.name} (Copy)`,
            slug: `${fullProduct.slug}-copy-${Date.now().toString().slice(-4)}`,
            description: fullProduct.description,
            collection: fullProduct.collection,
            is_active: false, // 复制出来的默认下架，避免误上架
            is_featured: false,
            sort_order: fullProduct.sort_order || 0,
            images: fullProduct.images || [],
            attribute_config: fullProduct.attribute_config || [],
            specifications: fullProduct.specifications || [],
          },
          skus: (fullSkus || []).map(s => ({
            attributes: s.attributes,
            colour_hex: s.colour_hex,
            price_gbp:  s.price_gbp,
            stock_qty:  s.stock_qty,
            is_active:  s.is_active,
            images:     s.images || [],
          })),
        }),
      })
      const data = await createRes.json()
      // 用 InfoDialog 而不是内联提示：复制是在列表页触发的，
      // 而列表页没有渲染内联消息的位置，之前这条反馈实际上没人看得见
      if (data.id) {
        setInfoState({ title: '已复制', message: '已复制产品，请修改名称/图片后重新上架' })
        loadProducts()
      } else {
        setInfoState({ title: '复制失败', message: data.error || '未知错误' })
      }
    } catch (e) {
      setInfoState({ title: '复制失败', message: e.message })
    }
  }

  if (editing !== null) {
    return (
      <>
        <ConfirmDialog
          open={!!confirmState}
          title="删除产品"
          message={confirmState ? `确定删除「${confirmState.product.name}」？` : ''}
          danger
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
        <InfoDialog open={!!infoState} title={infoState?.title} message={infoState?.message} onClose={() => setInfoState(null)} />
        <ProductEditor
          key={editing === 'new' ? 'new' : editing.id}
          product={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadProducts() }}
          onDelete={p => setConfirmState({ type: 'delete', product: p })}
        />
      </>
    )
  }

  return (
    <div>
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.type === 'delete' ? '删除产品' : '复制产品'}
        message={confirmState ? (confirmState.type === 'delete' ? `确定删除「${confirmState.product.name}」？` : `复制「${confirmState.product.name}」为新产品？`) : ''}
        danger={confirmState?.type === 'delete'}
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />
      <InfoDialog open={!!infoState} title={infoState?.title} message={infoState?.message} onClose={() => setInfoState(null)} />

      <ProductList
        products={products}
        skuMap={skuMap}
        loading={loading}
        onEdit={setEditing}
        onDuplicate={p => setConfirmState({ type: 'duplicate', product: p })}
        onDelete={p => setConfirmState({ type: 'delete', product: p })}
      />
    </div>
  )
}
