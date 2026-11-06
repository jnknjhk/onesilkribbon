'use client'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { parseStockQuantity } from '../../lib/stock-quantity'
import { money } from '../../lib/format'
import {
  Card, SearchInput, Select, DataTable, Pager, Badge, Button, ButtonLink, Input,
  EmptyState, Notice, useToast, styles as s,
} from '../../ui'

export default function StockView({ data, setData, loading, reload, get, set }) {
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

function skuLabel(k) {
  const attrs = Object.entries(k.attributes || {}).map(([, v]) => v).filter(Boolean)
  return attrs.length ? attrs.join(' · ') : (k.colour && k.colour !== '默认' ? k.colour : '默认规格')
}
