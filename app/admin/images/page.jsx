'use client'
import { useState, useEffect, useRef } from 'react'

const C = {
  bg: '#F5F3F0', card: '#FFFFFF', border: '#E8E4DF',
  gold: '#B89B6A', goldDark: '#9A7E50', ink: '#1C1714',
  sub: '#6B6460', muted: '#A8A4A0', red: '#D04040',
  green: '#4CAF7D', light: '#EDE9E4',
}

const GROUPS = [
  {
    label: '首页轮播图',
    desc: '首页全屏背景轮播图，上传几张就轮播几张，一张都没有则显示纯色背景。建议尺寸 1920×1080px 或以上，横向构图',
    keys: [
      { key: 'home_hero_1', label: '轮播图 1' },
      { key: 'home_hero_2', label: '轮播图 2' },
      { key: 'home_hero_3', label: '轮播图 3' },
      { key: 'home_hero_4', label: '轮播图 4' },
      { key: 'home_hero_5', label: '轮播图 5' },
    ],
  },
  {
    label: '首页系列图',
    desc: '首页"Our Collections"区块每个系列的展示图，建议尺寸 800×600px。没有上传时自动使用该系列的商品图片',
    keys: [
      { key: 'home_col_fine-silk-ribbons',        label: 'Fine Silk Ribbons' },
      { key: 'home_col_hand-frayed-silk-ribbons', label: 'Hand-Frayed Silk Ribbons' },
      { key: 'home_col_handcrafted-adornments',   label: 'Handcrafted Adornments' },
      { key: 'home_col_patterned-ribbons',         label: 'Patterned Ribbons' },
      { key: 'home_col_studio-tools',              label: 'Studio Tools' },
      { key: 'home_col_vintage-inspired-ribbons',  label: 'Vintage-Inspired Ribbons' },
    ],
  },
  {
    label: '首页品牌故事图',
    desc: '首页"Our Story"区块左侧的图片，建议尺寸 800×900px，竖向构图',
    keys: [
      { key: 'home_story', label: '品牌故事图' },
    ],
  },
  {
    label: '系列封面图',
    desc: '每个系列页顶部的 Hero 大图，建议尺寸 1600×900px 或以上，横向构图',
    keys: [
      { key: 'hero_fine-silk-ribbons',        label: 'Fine Silk Ribbons' },
      { key: 'hero_hand-frayed-silk-ribbons', label: 'Hand-Frayed Silk Ribbons' },
      { key: 'hero_handcrafted-adornments',   label: 'Handcrafted Adornments' },
      { key: 'hero_patterned-ribbons',        label: 'Patterned Ribbons' },
      { key: 'hero_studio-tools',             label: 'Studio Tools' },
      { key: 'hero_vintage-inspired-ribbons', label: 'Vintage-Inspired Ribbons' },
    ],
  },
  {
    label: 'About 页图片',
    desc: 'About 页面各区块的图片，建议尺寸 800×1000px，竖向构图',
    keys: [
      { key: 'about_main',  label: 'About 主图' },
      { key: 'about_craft', label: '工艺展示图' },
    ],
  },
]

export default function ImagesPage() {
  const [images, setImages]     = useState({})   // key -> url
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState({}) // key -> bool
  const [toast, setToast]       = useState(null)
  const fileRefs = useRef({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/site-images')
      const data = await res.json()
      const map  = {}
      for (const row of (Array.isArray(data) ? data : [])) {
        map[row.key] = row.url || null
      }
      setImages(map)
    } catch {}
    setLoading(false)
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleUpload(key, file) {
    if (!file) return
    setUploading(u => ({ ...u, [key]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('key', key)
      const res  = await fetch('/api/admin/site-images', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        setImages(prev => ({ ...prev, [key]: data.url }))
        showToast('图片已更新')
      } else {
        showToast(data.error || '上传失败', false)
      }
    } catch {
      showToast('上传失败', false)
    }
    setUploading(u => ({ ...u, [key]: false }))
  }

  async function handleDelete(key) {
    if (!confirm('确定要删除这张图片吗？删除后该位置将显示默认渐变色。')) return
    setUploading(u => ({ ...u, [key]: true }))
    try {
      await fetch('/api/admin/site-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, url: images[key] }),
      })
      setImages(prev => ({ ...prev, [key]: null }))
      showToast('图片已删除')
    } catch {
      showToast('删除失败', false)
    }
    setUploading(u => ({ ...u, [key]: false }))
  }

  if (loading) return (
    <div style={{ color: C.muted, fontSize: 13, padding: 40 }}>加载中…</div>
  )

  return (
    <div>
      {/* 标题 */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 300, marginBottom: 6 }}>图片管理</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>管理网站各页面的图片，支持 JPG、PNG、WebP 格式</p>
      </div>

      {/* 分组 */}
      {GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: 48 }}>
          {/* 组标题 */}
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ color: C.ink, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{group.label}</h2>
            <p style={{ color: C.muted, fontSize: 12 }}>{group.desc}</p>
          </div>

          {/* 图片卡片网格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {group.keys.map(({ key, label }) => {
              const url  = images[key]
              const busy = uploading[key]
              return (
                <div key={key} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  {/* 图片预览区 */}
                  <div style={{
                    aspectRatio: '16/9', background: '#E8DDD0',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {url ? (
                      <img src={url} alt={label} style={{
                        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                      }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, #E8DDD0, #C4A882)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 11, color: '#9A8878', letterSpacing: '0.1em' }}>暂无图片</span>
                      </div>
                    )}

                    {/* 上传中遮罩 */}
                    {busy && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(28,23,20,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: '#fff', fontSize: 12, letterSpacing: '0.1em' }}>上传中…</span>
                      </div>
                    )}
                  </div>

                  {/* 信息和操作 */}
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: 11, color: C.muted, marginBottom: 12, wordBreak: 'break-all', lineHeight: 1.5 }}>
                      {url ? '✓ 已上传' : '未设置，显示默认渐变色'}
                    </p>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* 上传/替换按钮 */}
                      <button
                        onClick={() => fileRefs.current[key]?.click()}
                        disabled={busy}
                        style={{
                          flex: 1, padding: '8px 0',
                          background: C.gold, border: 'none', borderRadius: 6,
                          color: '#fff', fontSize: 11, letterSpacing: '0.08em',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          opacity: busy ? 0.6 : 1, transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => { if (!busy) e.target.style.background = C.goldDark }}
                        onMouseLeave={e => { if (!busy) e.target.style.background = C.gold }}
                      >
                        {url ? '替换图片' : '上传图片'}
                      </button>

                      {/* 删除按钮 */}
                      {url && (
                        <button
                          onClick={() => handleDelete(key)}
                          disabled={busy}
                          style={{
                            padding: '8px 12px',
                            background: C.light, border: 'none', borderRadius: 6,
                            color: C.red, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer',
                            opacity: busy ? 0.6 : 1, transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => { if (!busy) e.target.style.background = '#FAE8E8' }}
                          onMouseLeave={e => { if (!busy) e.target.style.background = C.light }}
                        >
                          删除
                        </button>
                      )}
                    </div>

                    {/* 隐藏文件选择器 */}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      ref={el => fileRefs.current[key] = el}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(key, file)
                        e.target.value = ''
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Toast 提示 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32,
          background: toast.ok ? C.ink : C.red,
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          fontSize: 13, zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
