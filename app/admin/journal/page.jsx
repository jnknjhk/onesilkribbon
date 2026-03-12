'use client'
import { useState, useEffect, useRef } from 'react'

const CATEGORIES = ['Guide', 'Behind the Scenes', 'Inspiration', 'News', 'Care & Tips']

const C = {
  bg: '#F5F3F0', white: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', ink: '#1C1714', sub: '#6B6460',
  muted: '#A8A4A0', light: '#EDE9E4',
  red: '#f87171', green: '#4ade80',
}

const inp = {
  width: '100%', padding: '10px 14px', background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.ink, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Jost', sans-serif",
}

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function JournalAdminPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const emptyForm = () => ({
    title: '', slug: '', category: 'Guide', excerpt: '',
    intro: '', cover_image: '', closing: '', read_time: '3 min read',
    is_published: false,
    sections: [{ heading: '', body: '' }],
  })

  const [form, setForm] = useState(emptyForm())

  useEffect(() => { loadPosts() }, [])

  async function loadPosts() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/journal')
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch { setPosts([]) }
    setLoading(false)
  }

  function startEdit(post) {
    if (post === 'new') {
      setForm(emptyForm())
      setEditing('new')
    } else {
      setForm({
        title: post.title || '',
        slug: post.slug || '',
        category: post.category || 'Guide',
        excerpt: post.excerpt || '',
        intro: post.intro || '',
        cover_image: post.cover_image || '',
        closing: post.closing || '',
        read_time: post.read_time || '3 min read',
        is_published: post.is_published || false,
        sections: post.sections?.length > 0 ? post.sections : [{ heading: '', body: '' }],
        was_published: post.is_published,
      })
      setEditing(post)
    }
    setMsg('')
  }

  // ── 封面图上传 ──
  async function handleCoverUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('productId', 'journal-' + Date.now())
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setForm(p => ({ ...p, cover_image: data.url }))
      else setMsg('上传失败：' + (data.error || ''))
    } catch (err) { setMsg('上传失败：' + err.message) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── 段落操作 ──
  function addSection() {
    setForm(p => ({ ...p, sections: [...p.sections, { heading: '', body: '' }] }))
  }
  function updateSection(i, field, value) {
    setForm(p => ({ ...p, sections: p.sections.map((s, j) => j === i ? { ...s, [field]: value } : s) }))
  }
  function removeSection(i) {
    setForm(p => ({ ...p, sections: p.sections.filter((_, j) => j !== i) }))
  }
  function moveSection(i, d) {
    setForm(p => {
      const arr = [...p.sections]
      const t = i + d
      if (t < 0 || t >= arr.length) return p;
      [arr[i], arr[t]] = [arr[t], arr[i]]
      return { ...p, sections: arr }
    })
  }

  // ── 保存 ──
  async function save() {
    if (!form.title.trim()) { setMsg('请填写文章标题'); return }
    if (!form.slug.trim()) { setMsg('请填写 URL Slug'); return }
    setSaving(true); setMsg('')
    try {
      const payload = {
        action: editing === 'new' ? 'create' : 'update',
        post: {
          ...(editing !== 'new' ? { id: editing.id } : {}),
          ...form,
          sections: form.sections.filter(s => s.heading.trim() || s.body.trim()),
        },
      }
      const res = await fetch('/api/admin/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.error) { setMsg('保存失败：' + result.error); setSaving(false); return }
      setMsg('保存成功 ✓')
      setTimeout(() => { setEditing(null); loadPosts() }, 800)
    } catch (err) { setMsg('保存失败：' + err.message) }
    setSaving(false)
  }

  async function deletePost(post) {
    if (!confirm(`确定删除「${post.title}」？`)) return
    await fetch('/api/admin/journal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', post: { id: post.id } }),
    })
    if (editing) setEditing(null)
    loadPosts()
  }

  // ═══════════════════════════════
  // 编辑界面
  // ═══════════════════════════════
  if (editing !== null) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* 顶部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 12, cursor: 'pointer', marginBottom: 8, padding: 0, display: 'block' }}>← 返回文章列表</button>
            <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300 }}>{editing === 'new' ? '新建文章' : `编辑：${form.title}`}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {msg && <span style={{ color: msg.includes('✓') ? C.green : C.red, fontSize: 12 }}>{msg}</span>}
            <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? '保存中…' : '保存文章'}
            </button>
          </div>
        </div>

        {/* 基本信息 */}
        <Section title="基本信息">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <Label>文章标题 *</Label>
              <input value={form.title} onChange={e => {
                const t = e.target.value
                setForm(p => ({ ...p, title: t, slug: editing === 'new' ? slugify(t) : p.slug }))
              }} style={inp} placeholder="How to Tie a Silk Ribbon Bow" />
            </div>
            <div>
              <Label>URL Slug *</Label>
              <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} style={inp} placeholder="how-to-tie-a-silk-ribbon-bow" />
            </div>
            <div>
              <Label>分类</Label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>阅读时间</Label>
              <input value={form.read_time} onChange={e => setForm(p => ({ ...p, read_time: e.target.value }))} style={inp} placeholder="3 min read" />
            </div>
            <div>
              <Label>发布状态</Label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[{ v: true, l: '已发布', c: C.green }, { v: false, l: '草稿', c: C.muted }].map(({ v, l, c }) => (
                  <button key={l} onClick={() => setForm(p => ({ ...p, is_published: v }))} style={{
                    flex: 1, padding: '10px 0', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: form.is_published === v ? c + '22' : C.bg,
                    border: `1px solid ${form.is_published === v ? c : C.border}`,
                    color: form.is_published === v ? c : C.muted,
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Label>文章摘要（显示在列表页）</Label>
            <textarea value={form.excerpt} onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))}
              style={{ ...inp, minHeight: 72, resize: 'vertical' }}
              placeholder="一两句话介绍文章内容…" />
          </div>
        </Section>

        {/* 封面图 */}
        <Section title="封面图片" sub="建议 1600×900，JPG 格式，用于文章列表和详情页头图">
          {form.cover_image && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/7', marginBottom: 16, overflow: 'hidden', borderRadius: 8, background: C.light }}>
              <img src={form.cover_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => setForm(p => ({ ...p, cover_image: '' }))} style={{
                position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none',
                color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
              }}>移除</button>
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            padding: '10px 24px', background: C.white, border: `1px dashed ${C.border}`,
            borderRadius: 6, color: C.gold, fontSize: 12, cursor: 'pointer',
          }}>
            {uploading ? '上传中…' : form.cover_image ? '更换图片' : '+ 上传封面图'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
        </Section>

        {/* 正文 */}
        <Section title="文章内容">
          <div style={{ marginBottom: 20 }}>
            <Label>引言段落（斜体大字，显示在正文开头）</Label>
            <textarea value={form.intro} onChange={e => setForm(p => ({ ...p, intro: e.target.value }))}
              style={{ ...inp, minHeight: 80, resize: 'vertical' }}
              placeholder="The perfect bow is slower than it looks…" />
          </div>

          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>正文段落</Label>
            <span style={{ fontSize: 11, color: C.muted }}>{form.sections.length} 个段落</span>
          </div>

          {form.sections.map((section, i) => (
            <div key={i} style={{ background: C.bg, borderRadius: 8, padding: 20, marginBottom: 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.08em' }}>段落 {i + 1}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SmallBtn onClick={() => moveSection(i, -1)} disabled={i === 0}>↑</SmallBtn>
                  <SmallBtn onClick={() => moveSection(i, 1)} disabled={i === form.sections.length - 1}>↓</SmallBtn>
                  <SmallBtn danger onClick={() => removeSection(i)} disabled={form.sections.length <= 1}>✕</SmallBtn>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label>小标题</Label>
                <input value={section.heading} onChange={e => updateSection(i, 'heading', e.target.value)}
                  style={{ ...inp, background: C.white }} placeholder="Start with the right length" />
              </div>
              <div>
                <Label>段落正文</Label>
                <textarea value={section.body} onChange={e => updateSection(i, 'body', e.target.value)}
                  style={{ ...inp, background: C.white, minHeight: 100, resize: 'vertical' }}
                  placeholder="段落内容…" />
              </div>
            </div>
          ))}

          <button onClick={addSection} style={{ padding: '10px 20px', background: C.white, border: `1px dashed ${C.border}`, borderRadius: 6, color: C.gold, fontSize: 12, cursor: 'pointer' }}>
            + 添加段落
          </button>

          <div style={{ marginTop: 20 }}>
            <Label>结尾段落（斜体，显示在文章末尾）</Label>
            <textarea value={form.closing} onChange={e => setForm(p => ({ ...p, closing: e.target.value }))}
              style={{ ...inp, minHeight: 72, resize: 'vertical' }}
              placeholder="The hallmark of a silk bow is its looseness…" />
          </div>
        </Section>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0', borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
          <div>
            {editing !== 'new' && (
              <button onClick={() => deletePost(editing)} style={{ background: 'none', border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, fontSize: 12, padding: '10px 20px', cursor: 'pointer' }}>删除此文章</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(null)} style={{ padding: '10px 24px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, fontSize: 12, cursor: 'pointer' }}>取消</button>
            <button onClick={save} disabled={saving} style={{ padding: '10px 28px', background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? '保存中…' : '保存文章'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════
  // 列表界面
  // ═══════════════════════════════
  const published = posts.filter(p => p.is_published).length
  const drafts = posts.length - published

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 8 }}>文章管理</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>共 {posts.length} 篇 · 已发布 {published} · 草稿 {drafts}</p>
        </div>
        <button onClick={() => startEdit('new')} style={{ background: C.gold, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, padding: '10px 24px', cursor: 'pointer' }}>+ 新建文章</button>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: C.muted, padding: 24, fontSize: 13 }}>加载中…</p>
        ) : posts.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>暂无文章，点击「新建文章」开始写作</p>
            <button onClick={() => startEdit('new')} style={{ background: C.gold, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '10px 24px', cursor: 'pointer' }}>+ 新建文章</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['封面', '标题', '分类', '阅读时间', '发布日期', '状态', '操作'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} style={{ borderBottom: '1px solid #F0EDE8', cursor: 'pointer' }} onClick={() => startEdit(post)}>
                  <td style={{ padding: '10px 16px', width: 56 }}>
                    {post.cover_image
                      ? <img src={post.cover_image} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                      : <div style={{ width: 40, height: 40, background: C.light, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✎</div>
                    }
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <p style={{ color: C.ink, fontSize: 13, fontWeight: 400 }}>{post.title}</p>
                    <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{post.slug}</p>
                  </td>
                  <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{post.category}</td>
                  <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{post.read_time}</td>
                  <td style={{ padding: '10px 16px', color: C.sub, fontSize: 12 }}>{formatDate(post.published_at)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      background: post.is_published ? C.green + '22' : C.muted + '22',
                      color: post.is_published ? C.green : C.muted,
                      fontSize: 11, padding: '3px 10px', borderRadius: 20,
                    }}>{post.is_published ? '已发布' : '草稿'}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(post)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.gold, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>编辑</button>
                      <button onClick={() => deletePost(post)} style={{ background: C.light, border: 'none', borderRadius: 4, color: C.red, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Section({ title, sub, children }) {
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

function Label({ children }) {
  return <label style={{ display: 'block', color: C.muted, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</label>
}

function SmallBtn({ onClick, disabled, danger, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 26, height: 26, border: `1px solid ${danger ? C.red : C.border}`, borderRadius: 4,
      background: C.white, color: danger ? C.red : C.sub, fontSize: 11,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  )
}
