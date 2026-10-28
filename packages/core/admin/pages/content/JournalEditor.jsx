'use client'
// 写文章 / 改文章。保存提交的数据和旧编辑页完全一样（包括 was_published，
// 后端靠它判断"第一次发布"时记发布时间），只是换了布局，并且删除前会先确认。
import { useEffect, useRef, useState } from 'react'
import { useAdminConfig } from '../../config'
import { api } from '../../lib/api'
import { slugify } from '../../lib/format'
import { journalLayout, prepareJournalSections } from '../../lib/journal-content'
import MediaPicker from '../../MediaPicker'
import {
  PageHeader, Card, Field, Input, Textarea, Select, Segmented, Button, Badge, Notice, ConfirmDialog,
  SkeletonRows, Icon, useToast, useUnsavedWarning, styles as s,
} from '../../ui'

const emptyForm = category => ({
  title: '', slug: '', category, excerpt: '',
  intro: '', cover_image: '', closing: '', read_time: '3 min read',
  is_published: false,
  layout: 'standard',
  sections: [{ type: 'text', heading: '', body: '' }],
})

function formFromPost(post) {
  return {
    title: post.title || '',
    slug: post.slug || '',
    category: post.category || 'Guide',
    excerpt: post.excerpt || '',
    intro: post.intro || '',
    cover_image: post.cover_image || '',
    closing: post.closing || '',
    read_time: post.read_time || '3 min read',
    is_published: post.is_published || false,
    layout: journalLayout(post),
    sections: post.sections?.length > 0
      ? post.sections.map(x => ({ type: x.type || 'text', ...x }))
      : [{ type: 'text', heading: '', body: '' }],
    was_published: post.is_published,
  }
}

export default function JournalEditor({ id, onBack, onCreated }) {
  const cfg = useAdminConfig()
  const isNew = id === 'new'
  const [post, setPost] = useState(isNew ? 'new' : null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  async function load() {
    try {
      const all = await api('/api/admin/journal')
      const found = (Array.isArray(all) ? all : []).find(p => p.id === id)
      if (!found) throw new Error('找不到这篇文章，可能已经被删除')
      setPost(found); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { if (!isNew) load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const back = { onClick: onBack, label: '文章列表' }
  if (error) return <div><PageHeader back={back} title="文章" /><Notice tone="danger">{error}</Notice></div>
  if (!post) return <div><PageHeader back={back} title="加载中…" /><Card><SkeletonRows rows={8} /></Card></div>

  return (
    <Form key={version} post={post} cfg={cfg} onBack={onBack}
      onSaved={async newId => {
        if (isNew) onCreated(newId)
        else { await load(); setVersion(v => v + 1) }
      }} />
  )
}

function Form({ post, cfg, onBack, onSaved }) {
  const toast = useToast()
  const isNew = post === 'new'
  const categories = cfg.journalCategories || []
  const [form, setForm] = useState(() => (isNew ? emptyForm(categories[0] || 'Guide') : formFromPost(post)))
  const [picker, setPicker] = useState(null) // 'cover' | 'new' | 段落序号
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const snapshot = JSON.stringify(form)
  const baseline = useRef(snapshot)
  const dirty = snapshot !== baseline.current
  useUnsavedWarning(dirty && !saving)

  // 返回按钮不是链接，拦不到，单独问一句
  const leave = () => { if (!dirty || window.confirm('有修改还没保存，确定离开吗？')) onBack() }
  const setF = patch => setForm(p => ({ ...p, ...patch }))
  const updateSection = (i, patch) => setForm(p => ({ ...p, sections: p.sections.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const moveSection = (i, d) => setForm(p => {
    const arr = [...p.sections]; const t = i + d
    if (t < 0 || t >= arr.length) return p
    ;[arr[i], arr[t]] = [arr[t], arr[i]]
    return { ...p, sections: arr }
  })

  function picked(urls) {
    const url = urls[0]
    if (!url) return
    if (picker === 'cover') setF({ cover_image: url })
    else if (picker === 'new') setForm(p => ({ ...p, sections: [...p.sections, { type: 'image', url, caption: '' }] }))
    else if (typeof picker === 'number') updateSection(picker, { url })
  }

  async function save() {
    setErr('')
    if (!form.title.trim()) { setErr('请填写文章标题'); return }
    if (!form.slug.trim()) { setErr('请填写网址'); return }
    setSaving(true)
    const payload = {
      action: isNew ? 'create' : 'update',
      post: {
        ...(isNew ? {} : { id: post.id }),
        ...form,
        sections: prepareJournalSections(form.sections, form.layout),
      },
    }
    let res
    try {
      res = await api('/api/admin/journal', { method: 'POST', body: payload })
      baseline.current = snapshot
      toast.success(form.is_published ? '已保存并发布' : '已保存为草稿')
    } catch (e) { setErr('保存失败：' + e.message); setSaving(false); return }
    try { await onSaved(isNew ? res.id : post.id) } finally { setSaving(false) }
  }

  async function remove() {
    setDeleting(true)
    try {
      await api('/api/admin/journal', { method: 'POST', body: { action: 'delete', post: { id: post.id } } })
      baseline.current = snapshot
      toast.success('文章已删除')
      onBack()
    } catch (e) { toast.error('删除失败：' + e.message); setDeleting(false); setConfirmDelete(false) }
  }

  return (
    <div>
      <PageHeader back={{ onClick: leave, label: '文章列表' }}
        title={isNew ? '写新文章' : (form.title || '未命名文章')}
        subtitle={!isNew && (post.is_published ? <Badge tone="success">已发布</Badge> : <Badge>草稿</Badge>)}
        actions={!isNew && post.is_published && (
          <a className={`${s.btn} ${s.btn_secondary}`} href={`${cfg.siteUrl}/journal/${post.slug}`} target="_blank" rel="noreferrer">
            <Icon name="external" size={16} /><span>在网站上查看</span>
          </a>
        )} />

      <div className={s.split}>
        <div className={s.stack}>
          <Card title="标题与摘要">
            <div className={s.stack}>
              <Field label="文章标题" required>
                <Input value={form.title} placeholder="How to Tie a Silk Ribbon Bow"
                  onChange={e => { const t = e.target.value; setForm(p => ({ ...p, title: t, slug: isNew ? slugify(t) : p.slug })) }} />
              </Field>
              <Field label="摘要" hint="显示在文章列表页，一两句话">
                <Textarea rows={2} value={form.excerpt} onChange={e => setF({ excerpt: e.target.value })} />
              </Field>
              <Field label="引言" hint="斜体大字，显示在正文开头">
                <Textarea rows={3} value={form.intro} placeholder="The perfect bow is slower than it looks…" onChange={e => setF({ intro: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title="正文" subtitle="按顺序显示。文字段可以有小标题；图片段可以加图注">
            <div className={s.stack}>
              {form.sections.map((sec, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Badge tone={sec.type === 'image' ? 'info' : 'neutral'} icon={sec.type === 'image' ? 'image' : 'file'}>第 {i + 1} 段 · {sec.type === 'image' ? '图片' : '文字'}</Badge>
                    <span style={{ flex: 1 }} />
                    <Button size="sm" iconOnly variant="ghost" icon="arrowUp" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label="上移" />
                    <Button size="sm" iconOnly variant="ghost" icon="arrowDown" disabled={i === form.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label="下移" />
                    <Button size="sm" iconOnly variant="ghost" icon="trash" disabled={form.sections.length <= 1}
                      onClick={() => setForm(p => ({ ...p, sections: p.sections.filter((_, j) => j !== i) }))} aria-label="删除这一段" />
                  </div>
                  {sec.type === 'image' ? (
                    <div className={s.stack} style={{ gap: 10 }}>
                      {sec.url
                        ? <img src={sec.url} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, display: 'block' }} />
                        : <div className={s.muted}>还没有选图</div>}
                      <div><Button size="sm" icon="image" onClick={() => setPicker(i)}>{sec.url ? '换一张' : '选择图片'}</Button></div>
                      <Field label="图注（可选）">
                        <Input value={sec.caption || ''} placeholder="A close-up of the hand-frayed edge…" onChange={e => updateSection(i, { caption: e.target.value })} />
                      </Field>
                    </div>
                  ) : (
                    <div className={s.stack} style={{ gap: 10 }}>
                      <Field label="小标题（可选）">
                        <Input value={sec.heading || ''} placeholder="Start with the right length" onChange={e => updateSection(i, { heading: e.target.value })} />
                      </Field>
                      <Field label="段落" hint={form.layout === 'autumn' ? '空行分段；链接写成 [文字](https://网址)；引用行以 > 开头。' : undefined}>
                        <Textarea rows={5} value={sec.body || ''} onChange={e => updateSection(i, { body: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button icon="plus" onClick={() => setForm(p => ({ ...p, sections: [...p.sections, { type: 'text', heading: '', body: '' }] }))}>加一段文字</Button>
                <Button icon="image" onClick={() => setPicker('new')}>加一张图片</Button>
              </div>
            </div>
          </Card>

          <Card title="结尾">
            <Field hint="斜体，显示在文章末尾">
              <Textarea rows={3} value={form.closing} placeholder="The hallmark of a silk bow is its looseness…" onChange={e => setF({ closing: e.target.value })} />
            </Field>
          </Card>
        </div>

        <div className={s.stack}>
          <Card title="发布">
            <div className={s.stack}>
              <Segmented value={form.is_published} onChange={v => setF({ is_published: v })}
                options={[{ value: false, label: '草稿' }, { value: true, label: '发布' }]} />
              <div className={s.fieldHint}>{form.is_published ? '保存后网站上就能看到' : '草稿只在后台能看到'}</div>
            </div>
          </Card>
          <Card title="封面图">
            {form.cover_image ? (
              <div className={s.stack} style={{ gap: 10 }}>
                <img src={form.cover_image} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" icon="refresh" onClick={() => setPicker('cover')}>更换</Button>
                  <Button size="sm" variant="ghost" icon="x" onClick={() => setF({ cover_image: '' })}>移除</Button>
                </div>
              </div>
            ) : (
              <button type="button" className={s.imgAdd} style={{ width: '100%', aspectRatio: '16 / 10' }} onClick={() => setPicker('cover')}>
                <Icon name="plus" size={20} /><span>选择封面图</span>
              </button>
            )}
          </Card>
          <Card title="分类与网址">
            <div className={s.stack}>
              <Field label="文章版式">
                <Select value={form.layout} onChange={e => setF({ layout: e.target.value })}>
                  <option value="standard">标准文章</option>
                  <option value="autumn">秋季专题（目录与商品推荐）</option>
                </Select>
              </Field>
              <Field label="分类">
                <Select value={form.category} onChange={e => setF({ category: e.target.value })}>
                  {!categories.includes(form.category) && <option value={form.category}>{form.category}</option>}
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="阅读时间">
                <Input value={form.read_time} placeholder="3 min read" onChange={e => setF({ read_time: e.target.value })} />
              </Field>
              <Field label="网址" required hint={`${cfg.siteUrl.replace(/^https?:\/\//, '')}/journal/${form.slug || '…'}`}>
                <Input value={form.slug} className={s.mono} onChange={e => setF({ slug: e.target.value })} />
              </Field>
              {!isNew && post.is_published && form.slug !== post.slug && (
                <Notice tone="warning">这篇文章已经发布过，改网址后旧链接会打不开。</Notice>
              )}
            </div>
          </Card>
          {!isNew && (
            <Card title="删除文章">
              <Button variant="dangerGhost" icon="trash" onClick={() => setConfirmDelete(true)}>删除这篇文章</Button>
            </Card>
          )}
        </div>
      </div>

      <div className={s.saveBar}>
        <span className={s.saveBarMsg}>
          {err ? <span className={s.textDanger}>{err}</span> : dirty ? <><span className={s.dirtyDot} />有修改还没保存</> : isNew ? '写好后点保存' : '没有未保存的修改'}
        </span>
        <span style={{ flex: 1 }} />
        <Button variant="primary" icon="check" loading={saving} onClick={save} disabled={!isNew && !dirty}>
          {form.is_published ? '保存并发布' : '保存草稿'}
        </Button>
      </div>

      <MediaPicker open={picker !== null} namespace="journal" onClose={() => setPicker(null)} onSelect={picked} />
      <ConfirmDialog open={confirmDelete} title="删除文章" danger confirmLabel="删除" loading={deleting}
        message={`确定删除「${post?.title || ''}」吗？删除后无法恢复。`}
        onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
    </div>
  )
}
