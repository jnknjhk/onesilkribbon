'use client'
import { Card, Field, Input, Select, Segmented, Checkbox, Button, Notice, styles as s } from '../../ui'

export default function ProductSidebar({ form, setForm, cfg, isNew, product, slugChanged, onDelete }) {
  const setF = patch => setForm(p => ({ ...p, ...patch }))

  return (
    <div className={s.stack}>
      <Card title="状态">
        <div className={s.stack}>
          <Segmented value={form.active} onChange={v => setF({ active: v })}
            options={[{ value: true, label: '上架' }, { value: false, label: '下架' }]} />
          <Checkbox checked={form.featured} onChange={v => setF({ featured: v })}>首页精选（显示在首页推荐区）</Checkbox>
        </div>
      </Card>

      <Card title="分类">
        <div className={s.stack}>
          <Field label="所属系列">
            <Select value={form.collection} onChange={e => setF({ collection: e.target.value })}>
              {!cfg.collections.some(c => c.value === form.collection) && <option value={form.collection}>{form.collection}</option>}
              {cfg.collections.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="排序" hint="数字越小越靠前，默认 0">
            <Input type="number" value={form.sort_order ?? 0} onChange={e => setF({ sort_order: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="网址">
        <Field label="商品网址" required hint={isNew ? '根据商品名称自动生成，一般不用改' : undefined}>
          <Input value={form.slug} onChange={e => setF({ slug: e.target.value })} className={s.mono} />
        </Field>
        <div className={s.cellSub} style={{ marginTop: 6, wordBreak: 'break-all' }}>{cfg.siteUrl.replace(/^https?:\/\//, '')}/collections/{form.collection}/{form.slug || '…'}</div>
        {slugChanged && <Notice tone="info" style={{ marginTop: 10 }}>改网址后，旧链接（…/{product.slug}）会自动跳转到新网址，已经分享出去的链接不会失效。</Notice>}
      </Card>

      {!isNew && (
        <Card title="删除商品">
          <p className={s.muted} style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6 }}>有订单记录的商品不会真的删除，会改为下架，订单历史保留。</p>
          <Button variant="dangerGhost" icon="trash" onClick={onDelete}>删除这个商品</Button>
        </Card>
      )}
    </div>
  )
}
