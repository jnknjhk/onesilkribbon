'use client'
import { useState, useEffect } from 'react'
import { Pagination } from '@osr/core/components/admin/Pagination'
import { C, inp, COLLECTIONS, PAGE_SIZE, collectionLabel } from './ui'

// 产品列表：搜索、按系列筛选、分页，以及每行的编辑/复制/删除入口。
// 搜索和分页都是纯前端的——列表数据由父组件一次性拉好后传进来。
export default function ProductList({ products, skuMap, loading, onEdit, onDuplicate, onDelete }) {
  const [search, setSearch] = useState('')
  const [filterCol, setFilterCol] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [search, filterCol])

  const filtered = products.filter(p => {
    const ms = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.slug?.toLowerCase().includes(search.toLowerCase())
    const mc = filterCol === 'all' || p.collection === filterCol
    return ms && mc
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <div className="admin-products-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>产品管理</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>共 {products.length} 个产品</p>
        </div>
        <button onClick={() => onEdit('new')} className="admin-tap-target" style={{ background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '10px 24px', cursor: 'pointer' }}>+ 新建产品</button>
      </div>

      <div className="admin-products-filters" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索产品名称…" style={{ flex: 1, ...inp }} />
        <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ ...inp, width: 200 }}>
          <option value="all">全部系列</option>
          {COLLECTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>加载中…</p> : paginated.length === 0 ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>暂无产品</p>
        ) : (
          <table className="admin-list-table admin-products-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 56 }} />
              <col style={{ width: 220 }} />
              <col />
              <col style={{ width: 60 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['', '产品名称', '系列', '图片', '属性', '库存', '状态', '操作'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => {
                const imgs = Array.isArray(p.images) ? p.images : []
                const isActive = p.is_active !== false
                const attrs = p.attribute_config || []
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F0EDE8', cursor: 'pointer' }} onClick={() => onEdit(p)}>
                    <td data-label="图片" style={{ padding: '10px 16px' }}>
                      {imgs[0]
                        ? <img src={imgs[0]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                        : <div style={{ width: 40, height: 40, background: C.light, borderRadius: 4 }} />}
                    </td>
                    <td data-label="产品名称" style={{ padding: '10px 16px', overflow: 'hidden' }}>
                      <p style={{ color: C.ink, fontSize: 13, fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{p.name}</p>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '2px 0 0' }}>{p.slug}</p>
                    </td>
                    <td data-label="系列" style={{ padding: '10px 16px', color: C.sub, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{collectionLabel(p.collection)}</td>
                    <td data-label="图片数" style={{ padding: '10px 16px', color: C.sub, fontSize: 12, whiteSpace: 'nowrap' }}>{imgs.length} 张</td>
                    <td data-label="属性" style={{ padding: '10px 16px', color: C.sub, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attrs.length > 0 ? attrs.map(a => a.name).join('、') : '-'}</td>
                    <td data-label="库存" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const skus = skuMap[p.id] || []
                        if (skus.length === 0) return <span style={{ color: C.muted, fontSize: 12 }}>—</span>
                        const hasOut = skus.some(k => (k.stock_qty || 0) === 0)
                        const hasLow = skus.some(k => (k.stock_qty || 0) > 0 && (k.stock_qty || 0) < 10)
                        if (hasOut) return <span style={{ fontSize: 11, color: C.red, background: C.red + '18', padding: '3px 8px', borderRadius: 10 }}>⚠ 售罄</span>
                        if (hasLow) return <span style={{ fontSize: 11, color: '#facc15', background: '#facc1518', padding: '3px 8px', borderRadius: 10 }}>⚠ 不足</span>
                        return <span style={{ fontSize: 11, color: C.green }}>正常</span>
                      })()}
                    </td>
                    <td data-label="状态" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ background: isActive ? C.green + '22' : C.red + '22', color: isActive ? C.green : C.red, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{isActive ? '上架' : '下架'}</span>
                    </td>
                    <td data-label="操作" style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => onEdit(p)} className="admin-tap-target" style={{ background: C.light, border: 'none', borderRadius: 4, color: C.gold, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>编辑</button>
                        <button onClick={() => onDuplicate(p)} className="admin-tap-target" style={{ background: C.light, border: 'none', borderRadius: 4, color: C.sub, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>复制</button>
                        <button onClick={() => onDelete(p)} className="admin-tap-target" style={{ background: C.light, border: 'none', borderRadius: 4, color: C.red, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>删除</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} totalCount={filtered.length} onChange={setPage} />
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .admin-products-filters { flex-direction: column; }
        }
      ` }} />
    </>
  )
}
