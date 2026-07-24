import { supabaseAdmin as supabase } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-error'

// 获取所有网站图片
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase
      .from('site_images')
      .select('*')
      .order('key')
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err) {
    return errorResponse(err, { tag: 'admin-site-images-get' })
  }
}

// 把某个位置指向媒体库里的一张图——实际上传已经在 /api/admin/media 那边做完了，
// 这里只是把 { key -> url } 这条关系存下来
export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { key, url } = await req.json()
    if (!key || !url) return NextResponse.json({ error: 'Missing key or url' }, { status: 400 })

    const { error } = await supabase
      .from('site_images')
      .upsert({ key, url, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) throw error
    return NextResponse.json({ url })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-site-images-post' })
  }
}

// 清空某个位置的图片——只清引用，不删媒体库里的文件（那张图可能在别处还在用，
// 真的要删文件请去媒体库管理页操作）
export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { key } = await req.json()
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    const { error } = await supabase
      .from('site_images')
      .update({ url: null, updated_at: new Date().toISOString() })
      .eq('key', key)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-site-images-delete' })
  }
}
