'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { compressImage, friendlyUploadError } from '@/lib/client/compress-image'

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', light: '#EDE9E4', red: '#f87171',
}

const PAGE_SIZE = 60

export default function MediaLibraryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [confirmItem, setConfirmItem] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
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
      setTotal(data.total || 0)
    } catch { setItems([]) }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setError('')
    for (const file of files) {
      let res
      try {
        const compressed = await compressImage(file)
        const fd = new FormData()
        fd.append('file', compressed)
        fd.append('namespace', 'general')
        res = await fetch('/api/admin/media', { method: 'POST', body: fd })
        const data = await res.json()
        if (!data.media) setError(data.error || '上传失败')
      } catch (err) { setError(friendlyUploadError(err, res)) }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setPage(1)
    load()
  }

  async function handleDelete() {
    if (!confirmItem) return
    setConfirmLoading(true)
    try {
      await fetch('/api/admin/media', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmItem.id }),
      })
      load()
    } catch {}
    setConfirmLoading(false)
    setConfirmItem(null)
  }

  return (
    <div>
      <ConfirmDialog
        open={!!confirmItem}
        title="从媒体库删除"
        message="确定要彻底删除这张图片吗？如果它还在某个商品/文章/首页图里被引用，那些地方的图片会失效。这个操作不能撤销。"
        danger
        loading={confirmLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmItem(null)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>媒体库</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>共 {total} 张图片 · 商品图、文章图、首页图统一在这里管理，各处上传的图都会出现在这里，可以互相复用</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '10px 24px', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
          {uploading ? '上传中…' : '+ 上传图片'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 16 }}>{error}</p>}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文件名…"
        style={{ width: '100%', padding: '9px 14px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />

      {loading ? (
        <p style={{ color: C.muted, fontSize: 13, padding: 40, textAlign: 'center' }}>加载中…</p>
      ) : items.length === 0 ? (
        <p style={{ color: C.muted, fontSize: 13, padding: 40, textAlign: 'center' }}>{search ? '没有匹配的图片' : '媒体库还是空的，点右上角上传第一张图'}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {items.map(item => (
            <div key={item.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ aspectRatio: '1/1', position: 'relative', background: C.bg }}>
                <img src={item.url} alt={item.filename || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: 11, color: C.sub, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.filename}>
                  {item.filename || '—'}
                </p>
                <button onClick={() => setConfirmItem(item)} style={{ width: '100%', padding: '5px 0', background: C.light, border: 'none', borderRadius: 4, color: C.red, fontSize: 11, cursor: 'pointer' }}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="admin-tap-target"
            style={{ padding: '6px 14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>上一页</button>
          <span style={{ fontSize: 12, color: C.muted }}>第 {page} / {totalPages} 页</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="admin-tap-target"
            style={{ padding: '6px 14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>下一页</button>
        </div>
      )}
    </div>
  )
}
