'use client'
import { Card, Input, Button, styles as s } from '../../ui'

export default function ProductSpecificationsCard({ specifications, setSpecifications }) {
  return (
    <Card title="规格参数" subtitle="显示在商品详情页的 Description 标签里，比如 Material / 100% Pure Mulberry Silk">
      <div className={s.stack} style={{ gap: 8 }}>
        {specifications.map((spec, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr) auto', gap: 8 }}>
            <Input value={spec.key} placeholder="名称，如 Material"
              onChange={e => setSpecifications(p => p.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            <Input value={spec.value} placeholder="内容，如 100% Pure Mulberry Silk"
              onChange={e => setSpecifications(p => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <Button iconOnly variant="ghost" icon="x" aria-label="删除这一项" disabled={specifications.length <= 1}
              onClick={() => setSpecifications(p => p.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div><Button size="sm" variant="ghost" icon="plus" onClick={() => setSpecifications(p => [...p, { key: '', value: '' }])}>添加一项</Button></div>
      </div>
    </Card>
  )
}
