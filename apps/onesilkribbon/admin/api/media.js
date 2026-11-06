// /api/admin/media —— 媒体库
//   GET ?search=&page=   分页浏览（选图弹窗和"内容 → 媒体库"共用）
//   POST formData        上传一张图并登记
//   DELETE { id }        彻底删除文件。正在被商品 / SKU / 网站图片 / 文章使用的图不让删，
//                        以前删了之后那些地方会直接显示成裂图
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { fetchAll } from './_helpers'

const PAGE_SIZE = 60
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const NAMESPACES = new Set(['product', 'journal', 'site', 'general'])
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
])

function normalizeMimeType(value) {
  const mime = String(value || '').toLowerCase().split(';')[0].trim()
  return mime === 'image/jpg' ? 'image/jpeg' : mime
}

// 只看文件声明不够：把任意文件改名成 .jpg 也能绕过。这里检查常见图片的魔数。
function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png'
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brands = buffer.subarray(8, Math.min(buffer.length, 32)).toString('ascii')
    if (brands.includes('avif') || brands.includes('avis')) return 'image/avif'
  }
  return null
}

function safeFilename(name) {
  return String(name || 'upload')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .slice(0, 200) || 'upload'
}

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  let query = supabaseAdmin.from('media').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id')
  if (search) query = query.ilike('filename', `%${search}%`)

  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) return errorResponse(error, { tag: 'admin-media-get' })
  return Response.json({ media: data || [], total: count || 0, page, totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)) })
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const namespace = String(formData.get('namespace') || 'general')
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: '没有收到图片文件' }, { status: 400 })
    }
    if (!NAMESPACES.has(namespace)) {
      return Response.json({ error: '无效的图片分类' }, { status: 400 })
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return Response.json({ error: '图片文件为空' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: '图片太大，请压缩后重试（最大 4MB）' }, { status: 413 })
    }

    const declared = normalizeMimeType(file.type)
    if (declared && !IMAGE_TYPES.has(declared)) {
      return Response.json({ error: '只支持 JPG、PNG、WebP、AVIF 或 GIF 图片' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return Response.json({ error: '图片太大，请压缩后重试（最大 4MB）' }, { status: 413 })
    }
    const detected = detectImageMime(buffer)
    if (!detected) {
      return Response.json({ error: '文件内容不是可识别的图片' }, { status: 400 })
    }
    if (declared && declared !== detected) {
      return Response.json({ error: '图片类型与文件内容不一致' }, { status: 400 })
    }

    const ext = IMAGE_TYPES.get(detected)
    const filename = safeFilename(file.name)
    const path = `${namespace}/${Date.now()}-${randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage.from('media')
      .upload(path, buffer, { contentType: detected, upsert: false })
    if (uploadError) return errorResponse(uploadError, { tag: 'admin-media-upload' })

    const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(path)
    const { data: record, error: insertError } = await supabaseAdmin.from('media')
      .insert({ url: urlData.publicUrl, path, filename, size_bytes: buffer.length, namespace })
      .select().single()
    if (insertError) {
      // 数据库登记失败时把刚上传的文件删掉，避免留下无法管理的孤儿文件。
      await supabaseAdmin.storage.from('media').remove([path])
      return errorResponse(insertError, { tag: 'admin-media-insert' })
    }
    return Response.json({ media: record })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-media-post' })
  }
}

// 哪些地方在用这张图。整行转成文字查找 url，不依赖列是 text[] 还是 jsonb
const USAGE = [
  { table: 'products',      cols: 'id, name, images, attribute_config', label: r => `商品「${r.name}」` },
  { table: 'product_skus',  cols: 'id, product_id, images',             label: () => '商品 SKU' },
  { table: 'site_images',   cols: 'key, url',                           label: r => `网站图片 ${r.key}` },
  { table: 'journal_posts', cols: 'id, title, cover_image, sections',   label: r => `文章「${r.title}」` },
]

async function findUsage(url) {
  const used = []
  for (const u of USAGE) {
    const { data, error } = await fetchAll(() => supabaseAdmin.from(u.table).select(u.cols).order(u.cols.split(',')[0].trim()))
    if (error) throw error
    for (const row of data) if (JSON.stringify(row).includes(url)) used.push(u.label(row))
  }
  return [...new Set(used)]
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

    const { data: record } = await supabaseAdmin.from('media').select('path, url').eq('id', id).maybeSingle()
    if (!record) return Response.json({ error: '这张图已经不在媒体库里了' }, { status: 404 })

    const usedBy = await findUsage(record.url)
    if (usedBy.length) {
      return Response.json({
        error: `这张图正在被使用：${usedBy.slice(0, 5).join('、')}${usedBy.length > 5 ? ` 等 ${usedBy.length} 处` : ''}。请先在那里换掉或移除，再来删除。`,
        usedBy,
      }, { status: 409 })
    }

    await supabaseAdmin.storage.from('media').remove([record.path])
    const { error } = await supabaseAdmin.from('media').delete().eq('id', id)
    if (error) return errorResponse(error, { tag: 'admin-media-delete' })
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-media-delete' })
  }
}
