'use client'
// 内容：文章（有的站才显示）、网站图片、媒体库。原来是三个分开的菜单。
import { useEffect, useRef, useState } from 'react'
import { useAdminConfig } from '../../config'
import { api, clearApiCache } from '../../lib/api'
import { useApi } from '../../lib/use-api'
import { date } from '../../lib/format'
import { useUrlState } from '../../lib/url-state'
import { compressImage, friendlyUploadError } from '../../../lib/client/compress-image'
import MediaPicker from '../../MediaPicker'
import JournalEditor from './JournalEditor'
import {
  PageHeader, Card, Tabs, SearchInput, DataTable, Pager, Badge, Button, ConfirmDialog, EmptyState,
  Notice, SkeletonRows, Icon, useToast, Img, styles as s, cx,
} from '../../ui'

const DEFAULTS = { tab: '', post: '', page: '1', q: '' }

export default function ContentPage() {
  const cfg = useAdminConfig()
  const [get, set] = useUrlState(DEFAULTS)
  const tabs = [
    ...(cfg.features.journal ? [{ key: 'journal', label: '文章' }] : []),
    { key: 'images', label: '网站图片' },
    { key: 'media', label: '媒体库' },
  ]
  const tab = tabs.some(t => t.key === get('tab')) ? get('tab') : tabs[0].key
  const post = get('post')

  if (tab === 'journal' && post) {
    return <JournalEditor id={post} onBack={() => set({ post: '' })} onCreated={id => set({ post: id })} />
  }

  return (
    <div>
      <PageHeader title="内容" />
      <Tabs value={tab} onChange={v => set({ tab: v, page: 1, q: '' })} tabs={tabs} />
      {tab === 'journal' && <JournalList onOpen={id => set({ post: id }, { replace: false })} />}
      {tab === 'images' && <SiteImages />}
      {tab === 'media' && <MediaLibrary get={get} set={set} />}
    </div>
  )
}

// ── 文章列表 ──────────────────────────────────────────────────────────────────
function JournalList({ onOpen }) {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const PAGE = 30

  // 从文章编辑返回时先显示上次的列表，后台同时刷新
  const { data, error } = useApi('/api/admin/journal')
  useEffect(() => { if (error) toast.error('文章加载失败：' + error) }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  const posts = data ? (Array.isArray(data) ? data : []) : (error ? [] : null)

  const list = posts || []
  const published = list.filter(p => p.is_published).length
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE))

  return (
    <>
      <div className={s.toolbar}>
        <span className={s.muted} style={{ flex: 1, fontSize: 14 }}>{list.length} 篇 · 已发布 {published} · 草稿 {list.length - published}</span>
        <Button variant="primary" icon="plus" onClick={() => onOpen('new')}>写新文章</Button>
      </div>
      <Card padded={false}>
        <DataTable loading={!posts} rows={list.slice((page - 1) * PAGE, page * PAGE)} onRowClick={p => onOpen(p.id)}
          empty={<EmptyState icon="file" title="还没有文章" action={<Button variant="primary" icon="plus" onClick={() => onOpen('new')}>写第一篇</Button>} />}
          columns={[
            { key: 't', header: '标题', primary: true, render: p => (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {p.cover_image ? <Img src={p.cover_image} width={44} className={s.thumb} /> : <span className={s.thumb} />}
                <div style={{ minWidth: 0 }}>
                  <div className={s.cellMain}>{p.title || '（无标题）'}</div>
                  <div className={s.cellSub}>{p.category}</div>
                </div>
              </div>
            ) },
            { key: 's', header: '状态', render: p => p.is_published ? <Badge tone="success">已发布</Badge> : <Badge>草稿</Badge> },
            { key: 'd', header: '日期', align: 'right', render: p => <span className={s.muted}>{date(p.published_at || p.created_at)}</span> },
          ]} />
        {posts && <Pager page={page} totalPages={totalPages} total={list.length} unit="篇" onChange={setPage} />}
      </Card>
    </>
  )
}

// ── 网站图片 ──────────────────────────────────────────────────────────────────
function SiteImages() {
  const cfg = useAdminConfig()
  const toast = useToast()
  const [images, setImages] = useState(null)
  const [busy, setBusy] = useState({})
  const [picker, setPicker] = useState(null)   // 正在给哪个位置选图
  const [confirm, setConfirm] = useState(null) // { key, label }

  useEffect(() => {
    api('/api/admin/site-images')
      .then(rows => setImages(Object.fromEntries((Array.isArray(rows) ? rows : []).map(r => [r.key, r.url || null]))))
      .catch(e => { toast.error('加载失败：' + e.message); setImages({}) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function assign(key, url) {
    if (!url) return
    setBusy(b => ({ ...b, [key]: true }))
    try {
      const d = await api('/api/admin/site-images', { method: 'POST', body: { key, url } })
      setImages(m => ({ ...m, [key]: d.url }))
      toast.success('图片已更换')
    } catch (e) { toast.error('设置失败：' + e.message) }
    setBusy(b => ({ ...b, [key]: false }))
  }

  async function clear() {
    const { key } = confirm
    setBusy(b => ({ ...b, [key]: true }))
    try {
      await api('/api/admin/site-images', { method: 'DELETE', body: { key } })
      setImages(m => ({ ...m, [key]: null }))
      toast.success('已清空，这个位置会显示默认效果')
    } catch (e) { toast.error('操作失败：' + e.message) }
    setBusy(b => ({ ...b, [key]: false }))
    setConfirm(null)
  }

  if (!images) return <Card><SkeletonRows rows={6} /></Card>

  return (
    <div className={s.stack}>
      {cfg.imageSlots.map(group => (
        <Card key={group.label} title={group.label} subtitle={group.desc}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {group.keys.map(({ key, label }) => {
              const url = images[key]
              return (
                <div key={key}>
                  {url ? (
                    <div className={s.imgTile} style={{ aspectRatio: '4 / 3' }}>
                      <Img src={url} width={240} alt={label} />
                      <div className={s.imgTileTools}>
                        <button type="button" className={s.imgTileBtn} onClick={() => setPicker(key)} disabled={busy[key]} title="更换" aria-label="更换"><Icon name="refresh" size={15} /></button>
                        <button type="button" className={s.imgTileBtn} onClick={() => setConfirm({ key, label })} disabled={busy[key]} title="清空" aria-label="清空"><Icon name="trash" size={15} /></button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={s.imgAdd} style={{ width: '100%', aspectRatio: '4 / 3' }} onClick={() => setPicker(key)} disabled={busy[key]}>
                      <Icon name="plus" size={20} /><span>选择图片</span>
                    </button>
                  )}
                  <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </Card>
      ))}
      <MediaPicker open={!!picker} namespace="site" onClose={() => setPicker(null)} onSelect={urls => assign(picker, urls[0])} />
      <ConfirmDialog open={!!confirm} title="清空这个位置" danger confirmLabel="清空" loading={confirm && busy[confirm.key]}
        message={`清空「${confirm?.label}」后网站上这里会显示默认效果。图片本身还留在媒体库里，随时可以重新选。`}
        onCancel={() => setConfirm(null)} onConfirm={clear} />
    </div>
  )
}

// ── 媒体库 ────────────────────────────────────────────────────────────────────
function MediaLibrary({ get, set }) {
  const toast = useToast()
  const page = parseInt(get('page'), 10) || 1
  const q = get('q')
  const [search, setSearch] = useState(q)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [blocked, setBlocked] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { setSearch(q) }, [q])
  useEffect(() => {
    if (search === q) return
    const t = setTimeout(() => set({ q: search, page: 1 }), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set('search', q)
  const { data: loaded, error, reload: load } = useApi(`/api/admin/media?${params}`)
  useEffect(() => { if (error) toast.error('加载失败：' + error) }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  const data = loaded || (error ? { media: [] } : null)

  async function upload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    let ok = 0
    for (const file of files) {
      let res
      try {
        const fd = new FormData()
        fd.append('file', await compressImage(file))
        fd.append('namespace', 'general')
        res = await fetch('/api/admin/media', { method: 'POST', body: fd })
        const d = await res.json()
        if (d.media) ok++
        else toast.error(`${file.name}：${d.error || '上传失败'}`)
      } catch (err) { toast.error(`${file.name}：${friendlyUploadError(err, res)}`) }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (ok) { clearApiCache(); toast.success(`已上传 ${ok} 张`); if (page !== 1) set({ page: 1 }); else load() }
  }

  async function remove() {
    setDeleting(true); setBlocked('')
    try {
      await api('/api/admin/media', { method: 'DELETE', body: { id: confirm.id } })
      toast.success('已从媒体库删除')
      setConfirm(null)
      load()
    } catch (e) {
      if (e.status === 409) setBlocked(e.message)
      else { toast.error('删除失败：' + e.message); setConfirm(null) }
    }
    setDeleting(false)
  }

  async function copy(url) {
    try { await navigator.clipboard.writeText(url); toast.success('图片链接已复制') } catch { toast.error('复制失败') }
  }

  const items = data?.media || []
  return (
    <>
      <div className={s.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="按文件名搜索" style={{ flex: 1, minWidth: 220 }} />
        <Button variant="primary" icon="upload" loading={uploading} onClick={() => fileRef.current?.click()}>上传图片</Button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={upload} style={{ display: 'none' }} />
      </div>
      <Notice tone="info" style={{ marginBottom: 14 }}>商品、文章、网站图片里用的图都在这里。正在被使用的图不能删除，要先在用到它的地方换掉。</Notice>
      <Card padded={!data || items.length > 0}>
        {!data ? <SkeletonRows rows={4} />
          : items.length === 0 ? <EmptyState icon="image" title={q ? '没有匹配的图片' : '媒体库还是空的'} />
            : (
              <div className={s.imgGrid}>
                {items.map(m => (
                  <div key={m.id}>
                    <div className={s.imgTile}>
                      <Img src={m.url} width={160} alt={m.filename || ''} />
                      <div className={s.imgTileTools}>
                        <button type="button" className={s.imgTileBtn} onClick={() => copy(m.url)} title="复制链接" aria-label="复制链接"><Icon name="copy" size={14} /></button>
                        <a className={s.imgTileBtn} href={m.url} target="_blank" rel="noreferrer" title="查看原图" aria-label="查看原图"><Icon name="external" size={14} /></a>
                        <button type="button" className={s.imgTileBtn} onClick={() => { setBlocked(''); setConfirm(m) }} title="删除" aria-label="删除"><Icon name="trash" size={14} /></button>
                      </div>
                    </div>
                    <div className={cx(s.cellSub)} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.filename}>{m.filename || '—'}</div>
                  </div>
                ))}
              </div>
            )}
        {data && <div style={{ margin: items.length ? '14px -18px -18px' : 0 }}><Pager page={page} totalPages={data.totalPages} total={data.total} unit="张" onChange={p => set({ page: p })} /></div>}
      </Card>
      <ConfirmDialog open={!!confirm} title="从媒体库删除" danger confirmLabel="删除" loading={deleting}
        message="文件会被彻底删除，无法恢复。" onCancel={() => setConfirm(null)} onConfirm={remove}>
        {confirm && <Img src={confirm.url} width={380} style={{ marginTop: 12, maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block' }} />}
        {blocked && <Notice tone="warning" style={{ marginTop: 12 }}>{blocked}</Notice>}
      </ConfirmDialog>
    </>
  )
}
