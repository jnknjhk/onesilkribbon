'use client'
import { useState } from 'react'
import { api } from '../../lib/api'
import { slugify } from '../../lib/format'
import { Button, Card, Field, Input, Notice, Textarea, useToast, styles as s } from '../../ui'

function InternalNameField({ productId, initialName }) {
  const toast = useToast()
  const [value, setValue] = useState(initialName)
  const [saved, setSaved] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const result = await api('/api/admin/products', { method: 'PATCH', body: { id: productId, internal_name: value.trim() } })
      setValue(result.internal_name)
      setSaved(result.internal_name)
      toast.success('内部中文名已保存')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Field label="内部中文名" hint="仅你的后台账号可见，用于搜索和打包核对。">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Input value={value} aria-label="内部中文名" maxLength={100} disabled={saving}
          onChange={event => setValue(event.target.value)} style={{ flex: '1 1 180px' }} />
        <Button size="sm" loading={saving} disabled={value.trim() === saved} onClick={save}>保存中文名</Button>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </Field>
  )
}

export default function ProductBasicCard({ form, isNew, setForm, product }) {
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
        {typeof product?.internal_name === 'string' && <InternalNameField productId={product.id} initialName={product.internal_name} />}
        <Field label="商品描述" hint="显示在商品详情页，写材质、特点、用途">
          <Textarea rows={6} value={form.description} onChange={e => setF({ description: e.target.value })} />
        </Field>
      </div>
    </Card>
  )
}
