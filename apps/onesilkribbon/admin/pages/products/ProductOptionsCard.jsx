'use client'
import { useState } from 'react'
import MediaPicker from '../../MediaPicker'
import { Card, Field, Input, Button, Icon, styles as s } from '../../ui'
import { optObj } from './product-editor-helpers'

export default function ProductOptionsCard({ attrConfig, setAttrConfig, onGenerate }) {
  const updateAttr = (i, fn) => setAttrConfig(p => p.map((a, j) => (j === i ? fn(a) : a)))
  const updateOpt = (ai, oi, patch) => updateAttr(ai, a => ({
    ...a,
    options: a.options.map((o, k) => (k === oi ? { ...optObj(o), ...patch } : o)),
  }))

  return (
    <Card title="选项" subtitle="顾客在商品页可以选的项目，比如颜色、宽度、长度"
      actions={attrConfig.length > 0 && <Button size="sm" variant="primary" icon="layers" onClick={onGenerate}>按选项生成 SKU</Button>}>
      <div className={s.stack}>
        {attrConfig.length === 0 && <div className={s.muted} style={{ fontSize: 14 }}>还没有选项。只有一种规格的商品可以不加选项，直接在下面添加一个 SKU。</div>}
        {attrConfig.map((attr, ai) => (
          <div key={ai} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
              <Field label="选项名称" style={{ flex: 1 }}>
                <Input value={attr.name} placeholder="例如：颜色、宽度、长度" onChange={e => updateAttr(ai, a => ({ ...a, name: e.target.value }))} />
              </Field>
              <Button variant="dangerGhost" icon="trash" onClick={() => setAttrConfig(p => p.filter((_, j) => j !== ai))}>删除选项</Button>
            </div>
            <div className={s.fieldLabel} style={{ marginBottom: 6 }}>选项值</div>
            <div className={s.stack} style={{ gap: 8 }}>
              {attr.options.map((opt, oi) => (
                <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input value={optObj(opt).value} placeholder={`选项值 ${oi + 1}`} onChange={e => updateOpt(ai, oi, { value: e.target.value })} />
                  <OptionImage image={optObj(opt).image} onChange={url => updateOpt(ai, oi, { image: url })} />
                  <Button iconOnly variant="ghost" icon="x" aria-label="删除这个值" disabled={attr.options.length <= 1}
                    onClick={() => updateAttr(ai, a => ({ ...a, options: a.options.filter((_, k) => k !== oi) }))} />
                </div>
              ))}
            </div>
            <Button size="sm" variant="ghost" icon="plus" style={{ marginTop: 8 }}
              onClick={() => updateAttr(ai, a => ({ ...a, options: [...a.options, { value: '', image: '' }] }))}>添加值</Button>
          </div>
        ))}
        <div><Button icon="plus" onClick={() => setAttrConfig(p => [...p, { name: '', options: [{ value: '', image: '' }] }])}>添加选项</Button></div>
      </div>
    </Card>
  )
}

// 选项值的配图（单张）
function OptionImage({ image, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {image ? (
        <span style={{ position: 'relative', flexShrink: 0 }}>
          <img src={image} alt="" className={s.thumb} style={{ width: 38, height: 38, cursor: 'pointer' }} onClick={() => setOpen(true)} title="点击更换" />
          <button type="button" onClick={() => onChange('')} aria-label="移除配图"
            style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', border: 0, background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="x" size={10} strokeWidth={3} />
          </button>
        </span>
      ) : (
        <button type="button" className={s.imgAdd} style={{ width: 38, height: 38, flexShrink: 0 }} onClick={() => setOpen(true)} title="给这个值配一张图" aria-label="添加配图">
          <Icon name="image" size={16} />
        </button>
      )}
      <MediaPicker open={open} namespace="product" onClose={() => setOpen(false)} onSelect={urls => onChange(urls[0])} />
    </>
  )
}
