'use client'
import { slugify } from '../../lib/format'
import { Card, Field, Input, Textarea, styles as s } from '../../ui'

export default function ProductBasicCard({ form, isNew, setForm }) {
  const setF = patch => setForm(p => ({ ...p, ...patch }))

  return (
    <Card title="基本信息">
      <div className={s.stack}>
        <Field label="商品名称" required>
          <Input value={form.name} placeholder="Mulberry Silk Ribbon"
            onChange={e => {
              const name = e.target.value
              setForm(p => ({ ...p, name, slug: isNew ? slugify(name) : p.slug }))
            }} />
        </Field>
        <Field label="商品描述" hint="显示在商品详情页，写材质、特点、用途">
          <Textarea rows={6} value={form.description} onChange={e => setF({ description: e.target.value })} />
        </Field>
      </div>
    </Card>
  )
}
