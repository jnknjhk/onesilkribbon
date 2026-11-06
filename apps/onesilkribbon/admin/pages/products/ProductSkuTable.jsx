'use client'
import { useState } from 'react'
import MediaPicker from '../../MediaPicker'
import { Card, Input, Segmented, Button, EmptyState, Icon, styles as s } from '../../ui'

export default function ProductSkuTable({ skus, attrNames, hasAttributes, deletedSkuIds, onUpdate, onUpdateAttr, onRemove, onAdd, onBatch }) {
  return (
    <Card title="SKU · 价格与库存" subtitle={`${skus.length} 个 SKU。每个 SKU 是一种可以单独下单的规格`} padded={false}
      actions={skus.length > 0 && <Button size="sm" icon="edit" onClick={onBatch}>批量调整</Button>}>
      {skus.length === 0 ? (
        <EmptyState icon="layers" title="还没有 SKU" text={hasAttributes ? '点上面的"按选项生成 SKU"，或手动添加' : '手动添加一个 SKU，填上价格和库存'} />
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
                        <Input size="sm" value={k.attributes?.[n] || ''} onChange={e => onUpdateAttr(i, n, e.target.value)} style={{ minWidth: 90 }} />
                      </td>
                    ))}
                    <td data-label="图片"><SkuImages images={k.images || []} onChange={imgs => onUpdate(i, { images: imgs })} /></td>
                    <td data-label="价格 (£)">
                      <Input size="sm" type="number" step="0.01" min="0" value={k.price_gbp ?? ''} placeholder="0.00"
                        onChange={e => onUpdate(i, { price_gbp: e.target.value })} style={{ width: 96 }} />
                    </td>
                    <td data-label="库存">
                      <div>
                        <Input size="sm" type="number" min="0" value={k.stock_qty ?? ''} onChange={e => onUpdate(i, { stock_qty: e.target.value })} style={{ width: 80 }} />
                        {stockChanged && <div className={s.cellSub}>原来 {k._loaded_stock_qty ?? 0}</div>}
                      </div>
                    </td>
                    <td data-label="状态">
                      <Segmented value={k.is_active !== false} onChange={v => onUpdate(i, { is_active: v })}
                        options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} />
                    </td>
                    <td>
                      <Button iconOnly size="sm" variant="ghost" icon="trash" aria-label="删除 SKU" onClick={() => onRemove(i)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '12px 18px', borderTop: skus.length ? '1px solid var(--border)' : 0 }}>
        <Button size="sm" icon="plus" onClick={onAdd}>手动添加 SKU</Button>
        {deletedSkuIds.length > 0 && <span className={s.muted} style={{ fontSize: 13, marginLeft: 12 }}>保存后删除 {new Set(deletedSkuIds).size} 个 SKU（有订单记录的改为停用）</span>}
      </div>
    </Card>
  )
}

// SKU 图片（可多张）
function SkuImages({ images, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', maxWidth: 170 }}>
      {images.map((url, i) => (
        <span key={`${i}-${url}`} style={{ position: 'relative' }}>
          <img src={url} alt="" className={s.thumb} style={{ width: 36, height: 36 }} />
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
