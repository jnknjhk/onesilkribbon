// /api/admin/media —— 媒体库。两个站共用
//   GET ?search=&page=   分页浏览（选图弹窗和"内容 → 媒体库"共用）
//   POST formData        上传一张图并登记
//   DELETE { id }        彻底删除文件。正在被商品 / SKU / 网站图片 / 文章使用的图不让删，
//                        以前删了之后那些地方会直接显示成裂图
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'

const PAGE_SIZE = 60

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
    const namespace = formData.get('namespace') || 'general'
    if (!file) return Response.json({ error: 'Missing file' }, { status: 400 })

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${namespace}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage.from('media')
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadError) return errorResponse(uploadError, { tag: 'admin-media-upload' })

    const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(path)
    const { data: record, error: insertError } = await supabaseAdmin.from('media')
      .insert({ url: urlData.publicUrl, path, filename: file.name, size_bytes: file.size, namespace })
      .select().single()
    if (insertError) return errorResponse(insertError, { tag: 'admin-media-insert' })
    return Response.json({ media: record })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-media-post' })
  }
}

// 哪些地方在用这张图。整行转成文字查找 url，不依赖列是 text[] 还是 jsonb；
// 表不存在（比如玻璃站没有文章表）就跳过
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
    if (error) {
      if (/does not exist|schema cache|relation/i.test(error.message || '')) continue
      throw error
    }
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
