'use client'
// SKU 批量调整：先按属性圈定范围，再统一改价格/库存，或批量启用/停用。
// 只算出新的 skus 数组交回编辑页（onApply），真正写库要等编辑页点"保存"。
import { useState } from 'react'
import { Modal, Button, Field, Select, Input, Segmented, Notice, styles as s } from '../../ui'

export default function BatchSkuModal({ open, onClose, skus, attrNames, onApply }) {
  const [filter, setFilter] = useState({})   // attrName -> value（'' = 不限）
  const [field, setField] = useState('price_gbp')
  const [mode, setMode] = useState('set')    // 'set' | 'add' | 'multiply'
  const [value, setValue] = useState('')

  if (!open) return null

  const targets = skus.filter(sku =>
    Object.entries(filter).every(([attr, val]) => !val || (sku.attributes?.[attr] || '') === val))
  const targetSet = new Set(targets)

  function close() {
    setValue(''); setFilter({})
    onClose()
  }

  function applyValue() {
    const val = parseFloat(value)
    if (value === '' || Number.isNaN(val)) return
    onApply(skus.map(sku => {
      if (!targetSet.has(sku)) return sku
      const current = parseFloat(sku[field] || 0)
      let next = mode === 'set' ? val
        : mode === 'add' ? Math.max(0, current + val)
          : Math.max(0, parseFloat((current * val).toFixed(2)))
      if (field === 'stock_qty') next = Math.max(0, Math.round(next))
      if (field === 'price_gbp') next = parseFloat(next.toFixed(2))
      return { ...sku, [field]: String(next) }
    }), `已调整 ${targets.length} 个 SKU 的${field === 'price_gbp' ? '价格' : '库存'}`)
    close()
  }

  function applyToggle(active) {
    onApply(skus.map(sku => targetSet.has(sku) ? { ...sku, is_active: active } : sku),
      `已${active ? '启用' : '停用'} ${targets.length} 个 SKU`)
    close()
  }

  const placeholder = mode === 'set' ? '输入新的数值' : mode === 'add' ? '正数增加，负数减少' : '倍数，例如 1.1 = 涨 10%'

  return (
    <Modal open title="批量调整 SKU" onClose={close} width={520}
      footer={<>
        <Button onClick={close}>取消</Button>
        <Button variant="primary" disabled={value === '' || !targets.length} onClick={applyValue}>应用到 {targets.length} 个 SKU</Button>
      </>}>
      <div className={s.stack}>
        {attrNames.length > 0 && (
          <div>
            <div className={s.fieldLabel} style={{ marginBottom: 8 }}>调整哪些 SKU（不选 = 全部）</div>
            <div className={s.grid2}>
              {attrNames.map(name => {
                const opts = [...new Set(skus.map(k => k.attributes?.[name] || '').filter(Boolean))]
                return (
                  <Field key={name} label={name}>
                    <Select size="sm" value={filter[name] || ''} onChange={e => setFilter(p => ({ ...p, [name]: e.target.value }))}>
                      <option value="">全部</option>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  </Field>
                )
              })}
            </div>
          </div>
        )}
        <Notice tone={targets.length ? 'info' : 'warning'}>已选中 {targets.length} / {skus.length} 个 SKU</Notice>

        <Field label="改什么" group>
          <Segmented value={field} onChange={setField} options={[{ value: 'price_gbp', label: '价格 (£)' }, { value: 'stock_qty', label: '库存' }]} />
        </Field>
        <Field label="怎么改" group>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'set', label: '设为' }, { value: 'add', label: '增加 / 减少' }, { value: 'multiply', label: '乘以' }]} />
        </Field>
        <Field label="数值">
          <Input type="number" step={field === 'price_gbp' ? '0.01' : '1'} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} />
        </Field>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div className={s.fieldLabel} style={{ marginBottom: 8 }}>或者批量启用 / 停用</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" icon="check" disabled={!targets.length} onClick={() => applyToggle(true)}>启用选中的</Button>
            <Button size="sm" variant="dangerGhost" icon="x" disabled={!targets.length} onClick={() => applyToggle(false)}>停用选中的</Button>
          </div>
        </div>
        <div className={s.fieldHint}>调整后还需要点页面底部的“保存”才会生效。</div>
      </div>
    </Modal>
  )
}
