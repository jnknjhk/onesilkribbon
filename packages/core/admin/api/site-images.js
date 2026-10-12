// /api/admin/site-images —— 网站各处图片位置（首页轮播、系列封面……）。两个站共用
//   GET              全部 { key, url }
//   POST {key,url}   把某个位置指向媒体库里的一张图（只存引用，上传在 /api/admin/media 完成）
//   DELETE {key}     清空某个位置（只清引用，不删媒体库里的文件）
import { supabaseAdmin as supabase } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { data, error } = await supabase.from('site_images').select('*').order('key')
    if (error) throw error
    return Response.json(data || [])
  } catch (err) {
    return errorResponse(err, { tag: 'admin-site-images-get' })
  }
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { key, url } = await req.json()
    if (!key || !url) return Response.json({ error: 'Missing key or url' }, { status: 400 })
    const { error } = await supabase.from('site_images')
      .upsert({ key, url, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
    return Response.json({ url })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-site-images-post' })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { key } = await req.json()
    if (!key) return Response.json({ error: 'Missing key' }, { status: 400 })
    const { error } = await supabase.from('site_images')
      .update({ url: null, updated_at: new Date().toISOString() }).eq('key', key)
    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-site-images-delete' })
  }
}
