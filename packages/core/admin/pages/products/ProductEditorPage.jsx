'use client'
// /admin/products/[id]：按 id 取完整商品和它的全部 SKU，再交给编辑器。
// id 是 'new' 时直接打开空白编辑器。
//
// 走 /api/admin/products?id=（service role）而不是浏览器端的匿名客户端：product_skus 有
// "只公开已启用的 SKU" 的 RLS 策略，匿名读会漏掉停用的 SKU，保存时它们就会被当成"已删除"。
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../lib/api'
import { PageHeader, Notice, SkeletonRows, Card } from '../../ui'
import ProductEditor from './ProductEditor'

export default function ProductEditorPage({ id }) {
  const router = useRouter()
  const isNew = id === 'new'
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/admin/products?id=${encodeURIComponent(id)}`)
      setData(d); setError('')
    } catch (e) { setError(e.message) }
  }, [id])

  useEffect(() => { if (!isNew) load() }, [isNew, load])

  if (isNew) {
    return <ProductEditor product="new" initialSkus={[]} onSaved={newId => router.replace(`/admin/products/${newId}`)} />
  }
  if (error) {
    return (
      <div>
        <PageHeader back="/admin/products" title="商品" />
        <Notice tone="danger">{error}</Notice>
      </div>
    )
  }
  if (!data) return <div><PageHeader back="/admin/products" title="加载中…" /><Card><SkeletonRows rows={8} /></Card></div>

  return (
    <ProductEditor key={version} product={data.product} initialSkus={data.skus}
      onSaved={async () => { await load(); setVersion(v => v + 1) }} />
  )
}
