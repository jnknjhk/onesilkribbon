import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { errorResponse } from '@/lib/api-error'

const PAGE_SIZE = 60

// GET /api/admin/media?search=xxx&page=1 — 分页浏览媒体库（给选图弹窗和媒体库管理页共用）
export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabaseAdmin.from('media').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (search) query = query.ilike('filename', `%${search}%`)

  const { data, error, count } = await query.range(from, to)
  if (error) return errorResponse(error, { tag: 'admin-media-get' })

  return Response.json({ media: data || [], total: count || 0, page, totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)) })
}

// POST /api/admin/media — 上传一张新图，登记进媒体库
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
    const { error: uploadError } = await supabaseAdmin.storage
      .from('media')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return errorResponse(uploadError, { tag: 'admin-media-upload' })
    }

    const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(path)

    const { data: record, error: insertError } = await supabaseAdmin
      .from('media')
      .insert({
        url: urlData.publicUrl,
        path,
        filename: file.name,
        size_bytes: file.size,
        namespace,
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError, { tag: 'admin-media-insert' })
    }

    return Response.json({ media: record })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-media-post' })
  }
}

// DELETE /api/admin/media — 从媒体库彻底删除（连 storage 文件一起删）。
// 注意：这是"从库里删"，不是"从某个商品/文章里移除"——同一张图可能被多处引用，
// 移除引用不该顺手把文件也删了，只有在媒体库管理页里显式删除才会真的删文件。
export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

    const { data: record } = await supabaseAdmin.from('media').select('path').eq('id', id).single()
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 })

    await supabaseAdmin.storage.from('media').remove([record.path])
    const { error } = await supabaseAdmin.from('media').delete().eq('id', id)
    if (error) return errorResponse(error, { tag: 'admin-media-delete' })

    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-media-delete' })
  }
}
