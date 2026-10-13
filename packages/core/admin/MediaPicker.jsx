'use client'
// 统一的"选图/传图"弹窗。所有需要图片的地方（商品图、SKU 图、文章封面、网站图片……）
// 都从这里选：图片先进媒体库，之后哪里都能重复选用，不用每个地方各自上传一份。
//
// props: open, onClose, multiple, namespace（'product'|'journal'|'site'|'general'），onSelect(urls[])
import { useEffect, useRef, useState } from 'react'
import { compressImage, friendlyUploadError } from '../lib/client/compress-image'
import { clearApiCache } from './lib/api'
import { useApi } from './lib/use-api'
import { Modal, Button, SearchInput, Tabs, Notice, EmptyState, Icon, Img, styles as s, cx } from './ui'

export default function MediaPicker({ open, onClose, multiple = false, namespace = 'general', onSelect }) {
  const [tab, setTab] = useState('library')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')   // 停止输入 300ms 后才真正搜索
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState([]) // [{ id, url }]，翻页、搜索时保留
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // 每次打开清空上次选的；列表和"内容 → 媒体库"共用同一份缓存，第二次打开立刻有图
  useEffect(() => { if (open) { setPicked([]); setError('') } }, [open])
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ page: String(page) })
  if (query) params.set('search', query)
  const { data, error: loadError, loading, reload } = useApi(open ? `/api/admin/media?${params}` : null)
  const items = data?.media || []
  const totalPages = data?.totalPages || 1

  if (!open) return null

  function toggle(item) {
    if (!multiple) { onSelect([item.url]); onClose(); return }
    setPicked(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, { id: item.id, url: item.url }])
  }

  async function upload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true); setError('')
    const done = []
    for (const file of files) {
      let res
      try {
        const compressed = await compressImage(file)
        const fd = new FormData()
        fd.append('file', compressed)
        fd.append('namespace', namespace)
        res = await fetch('/api/admin/media', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.media) done.push(data.media)
        else setError(data.error || '上传失败')
      } catch (err) { setError(friendlyUploadError(err, res)) }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!done.length) return
    clearApiCache() // 媒体库多了新图，其它地方的缓存也要作废
    if (!multiple) { onSelect([done[0].url]); onClose(); return }
    // 多选：刚传的直接算选中，回到素材库第一页继续挑
    setPicked(p => [...p, ...done.map(m => ({ id: m.id, url: m.url }))])
    setTab('library'); setSearch(''); setQuery(''); setPage(1); reload()
  }

  return (
    <Modal open title="选择图片" onClose={onClose} width={860}
      footer={tab === 'library' && <>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }} className={s.muted}>
          <Button size="sm" iconOnly icon="chevronLeft" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="上一页" />
          第 {page} / {totalPages} 页
          <Button size="sm" iconOnly icon="chevronRight" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="下一页" />
        </div>
        <Button onClick={onClose}>取消</Button>
        {multiple && <Button variant="primary" disabled={!picked.length} onClick={() => { onSelect(picked.map(p => p.url)); onClose() }}>使用选中的 {picked.length || ''} 张</Button>}
      </>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'library', label: '媒体库' }, { key: 'upload', label: '上传新图' }]} />
      {(error || loadError) && <Notice tone="danger" style={{ marginBottom: 12 }}>{error || loadError}</Notice>}
      {tab === 'library' ? (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="按文件名搜索" style={{ marginBottom: 14 }} />
          {loading && !items.length ? <div className={s.muted} style={{ padding: 40, textAlign: 'center' }}>加载中…</div>
            : items.length === 0 ? <EmptyState icon="image" title="媒体库还是空的" action={<Button variant="primary" icon="upload" onClick={() => setTab('upload')}>上传第一张图</Button>} />
            : (
              <div className={s.imgGrid}>
                {items.map(item => {
                  const on = picked.some(p => p.id === item.id)
                  return (
                    <button key={item.id} type="button" className={cx(s.pickTile, on && s.pickTileOn)} onClick={() => toggle(item)} title={item.filename || ''}>
                      <Img src={item.url} width={160} alt={item.filename || ''} />
                      {on && <span className={s.pickCheck}><Icon name="check" size={14} strokeWidth={3} /></span>}
                    </button>
                  )
                })}
              </div>
            )}
        </>
      ) : (
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <button type="button" className={s.imgAdd} style={{ width: '100%', maxWidth: 380, aspectRatio: 'auto', padding: '48px 20px' }}
            onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name={uploading ? 'clock' : 'upload'} size={28} />
            <span style={{ color: 'var(--text-2)', fontSize: 14 }}>{uploading ? '上传中…' : multiple ? '点击选择图片（可多选）' : '点击选择图片'}</span>
            <span>会自动压缩，手机原图也可以直接传</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple={multiple} onChange={upload} style={{ display: 'none' }} />
        </div>
      )}
    </Modal>
  )
}
