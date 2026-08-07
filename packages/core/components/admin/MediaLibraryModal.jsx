'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { compressImage, friendlyUploadError } from '../../lib/client/compress-image'

const C = {
  border: '#E8E4DF', gold: '#B89B6A', ink: '#1C1714',
  sub: '#6B6460', muted: '#A8A4A0', bg: '#F5F3F0', red: '#ef4444',
}

// 统一的"选图/传图"弹窗。所有需要图片的地方（商品图、SKU图、文章封面、首页图……）
// 都从这一个组件选图，图片先进媒体库、库里能重复选用，不用每个地方各自重新上传一份。
//
// props:
//   open, onClose
//   multiple    — 是否允许多选（商品相册/SKU图用 true，封面图/首页图这类单图用 false）
//   namespace   — 新上传的图打个标签，方便以后在媒体库管理页筛选（'product' | 'journal' | 'site' | 'general'）
//   onSelect(urls) — urls 始终是数组，调用方按 multiple 与否自己取 urls[0] 或整个数组
export default function MediaLibraryModal({ open, onClose, multiple = false, namespace = 'general', onSelect }) {
  const [tab, setTab] = useState('library') // 'library' | 'upload'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/media?${params}`)
      const data = await res.json()
      setItems(data.media || [])
      setTotalPages(data.totalPages || 1)
    } catch { setItems([]) }
    setLoading(false)
  }, [page, search])

  useEffect(() => {
    if (!open) return
    setSelectedIds([])
    setError('')
    load()
  }, [open, load])

  useEffect(() => { setPage(1) }, [search])

  if (!open) return null

  const toggleSelect = (item) => {
    if (multiple) {
      setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])
    } else {
      onSelect([item.url])
      onClose()
    }
  }

  const confirmMultiSelect = () => {
    const urls = items.filter(i => selectedIds.includes(i.id)).map(i => i.url)
    onSelect(urls)
    onClose()
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setError('')
    const uploaded = []
    for (const file of files) {
      let res
      try {
        const compressed = await compressImage(file)
        const fd = new FormData()
        fd.append('file', compressed)
        fd.append('namespace', namespace)
        res = await fetch('/api/admin/media', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.media) uploaded.push(data.media)
        else setError(data.error || '上传失败')
      } catch (err) { setError(friendlyUploadError(err, res)) }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (uploaded.length > 0) {
      if (!multiple) {
        onSelect([uploaded[0].url])
        onClose()
        return
      }
      // 多选模式下：传完直接算选中，切回素材库 tab 让用户能看到并继续多选
      setSelectedIds(prev => [...prev, ...uploaded.map(u => u.id)])
      setTab('library')
      setPage(1)
      setSearch('')
      load()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 800, maxWidth: '92vw', height: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <TabBtn active={tab === 'library'} onClick={() => setTab('library')}>素材库</TabBtn>
            <TabBtn active={tab === 'upload'} onClick={() => setTab('upload')}>上传新图</TabBtn>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted }}>×</button>
        </div>

        {error && (
          <div style={{ padding: '10px 24px', background: '#FEF2F2', color: C.red, fontSize: 12 }}>{error}</div>
        )}

        {/* 内容 */}
        {tab === 'library' ? (
          <>
            <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文件名…"
                style={{ width: '100%', padding: '9px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {loading ? (
                <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 40 }}>加载中…</p>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>素材库还是空的</p>
                  <button onClick={() => setTab('upload')} style={{ background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '8px 18px', cursor: 'pointer' }}>去上传第一张图</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                  {items.map(item => {
                    const selected = selectedIds.includes(item.id)
                    return (
                      <button key={item.id} onClick={() => toggleSelect(item)} style={{
                        position: 'relative', aspectRatio: '1/1', border: selected ? `3px solid ${C.gold}` : `1px solid ${C.border}`,
                        borderRadius: 6, overflow: 'hidden', padding: 0, cursor: 'pointer', background: C.bg,
                      }}>
                        <img src={item.url} alt={item.filename || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {selected && (
                          <span style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: C.gold, color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: '6px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>上一页</button>
                <span style={{ fontSize: 12, color: C.muted }}>第 {page} / {totalPages} 页</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: '6px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>下一页</button>
              </div>
              {multiple && (
                <button onClick={confirmMultiSelect} disabled={selectedIds.length === 0}
                  style={{ padding: '9px 22px', background: selectedIds.length ? C.ink : C.border, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: selectedIds.length ? 'pointer' : 'not-allowed' }}>
                  使用选中的 {selectedIds.length || ''} 张
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
              width: '100%', maxWidth: 360, padding: '48px 24px', border: `2px dashed ${C.border}`, borderRadius: 10,
              background: C.bg, cursor: uploading ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 32 }}>{uploading ? '…' : '+'}</span>
              <span style={{ fontSize: 13, color: C.sub }}>{uploading ? '上传中…' : (multiple ? '点击选择图片（可多选）' : '点击选择图片')}</span>
              <span style={{ fontSize: 11, color: C.muted }}>会自动压缩，大图也没关系</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple={multiple} onChange={handleUpload} style={{ display: 'none' }} />
          </div>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
      background: active ? 'rgba(184,155,106,0.12)' : 'transparent',
      color: active ? C.gold : C.sub, fontWeight: active ? 500 : 400,
    }}>{children}</button>
  )
}
