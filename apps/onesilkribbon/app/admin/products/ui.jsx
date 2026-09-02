'use client'
import { useState } from 'react'
import MediaLibraryModal from '@osr/core/components/admin/MediaLibraryModal'

// 产品管理页共用的常量与展示型组件。
// 这些东西没有业务逻辑，纯粹是"长什么样"，抽出来让列表页/编辑页都能用。

export const PAGE_SIZE = 30

export const COLLECTIONS = [
  { value: 'fine-silk-ribbons',        label: '精品丝带 Fine Silk Ribbons' },
  { value: 'hand-frayed-silk-ribbons', label: '手工磨边 Hand-Frayed' },
  { value: 'handcrafted-adornments',   label: '手工饰品 Adornments' },
  { value: 'patterned-ribbons',        label: '图案丝带 Patterned' },
  { value: 'studio-tools',             label: '工作室工具 Studio Tools' },
  { value: 'vintage-inspired-ribbons', label: '复古系列 Vintage-Inspired' },
]

export const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', light: '#EDE9E4',
  red: '#f87171', green: '#4ade80',
}

export const inp = {
  width: '100%', padding: '10px 14px', background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Jost', sans-serif",
}

export function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function collectionLabel(v) {
  return COLLECTIONS.find(c => c.value === v)?.label || v
}

export function Section({ title, sub, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.ink, fontSize: 16, fontWeight: 400, marginBottom: sub ? 4 : 0 }}>{title}</h2>
        {sub && <p style={{ color: C.muted, fontSize: 11 }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

export function Label({ children }) {
  return <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</label>
}

export function SmallBtn({ onClick, disabled, danger, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 22, height: 22, border: 'none', borderRadius: 3,
      background: danger ? 'rgba(248,113,113,0.8)' : 'rgba(255,255,255,0.3)',
      color: '#fff', fontSize: 10, cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1,
    }}>{children}</button>
  )
}

/* ── SKU 图片上传组件 ── */
export function SkuImageUpload({ images, onChange }) {
  const [showPicker, setShowPicker] = useState(false)

  function handlePicked(urls) {
    onChange([...(images || []), ...urls])
  }

  function handleRemove(url) {
    onChange((images || []).filter(u => u !== url))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', maxWidth: 160 }}>
      {(images || []).map((url, i) => (
        <div key={i} style={{ position: 'relative', width: 36, height: 36 }}>
          <img src={url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 3, border: '1px solid #E8E4DF' }} />
          <button onClick={() => handleRemove(url)} style={{
            position: 'absolute', top: -4, right: -4, width: 14, height: 14,
            background: '#ef4444', border: 'none', borderRadius: '50%',
            color: '#fff', fontSize: 8, cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      ))}
      <button onClick={() => setShowPicker(true)} style={{
        width: 36, height: 36, border: '1px dashed #C8C0B8', borderRadius: 3, background: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#9A8878', fontSize: 18, flexShrink: 0,
      }}>+</button>
      <MediaLibraryModal
        open={showPicker}
        multiple
        namespace="product"
        onClose={() => setShowPicker(false)}
        onSelect={handlePicked}
      />
    </div>
  )
}

/* ── 属性选项图片上传组件 ── */
export function AttrOptionImage({ image, onChange }) {
  const [showPicker, setShowPicker] = useState(false)

  if (image) return (
    <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
      <img src={image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 3, border: '1px solid #E8E4DF' }} />
      <button onClick={() => onChange('')} style={{
        position: 'absolute', top: -4, right: -4, width: 14, height: 14,
        background: '#ef4444', border: 'none', borderRadius: '50%',
        color: '#fff', fontSize: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>
    </div>
  )

  return (
    <>
      <button onClick={() => setShowPicker(true)} style={{
        width: 36, height: 36, border: '1px dashed #C8C0B8', borderRadius: 3, background: 'none', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#9A8878', fontSize: 16,
      }} title="选择此选项的图片">🖼</button>
      <MediaLibraryModal
        open={showPicker}
        namespace="product"
        onClose={() => setShowPicker(false)}
        onSelect={urls => onChange(urls[0])}
      />
    </>
  )
}
