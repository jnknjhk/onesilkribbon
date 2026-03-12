import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// 获取所有网站图片
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_images')
      .select('*')
      .order('key')
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 上传并更新图片
export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const key  = formData.get('key')

    if (!file || !key) {
      return NextResponse.json({ error: 'Missing file or key' }, { status: 400 })
    }

    const ext      = file.name.split('.').pop().toLowerCase()
    const fileName = `${key}-${Date.now()}.${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    // 上传到 site-images bucket
    const { error: uploadError } = await supabase.storage
      .from('site-images')
      .upload(fileName, buffer, { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('site-images')
      .getPublicUrl(fileName)

    const url = urlData.publicUrl

    // 更新数据库
    const { error: dbError } = await supabase
      .from('site_images')
      .update({ url, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (dbError) throw dbError

    return NextResponse.json({ url })
  } catch (err) {
    console.error('Site image upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 删除图片（清空某个位置的图片）
export async function DELETE(req) {
  try {
    const { key, url } = await req.json()
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    // 从 storage 删除文件
    if (url) {
      const parts = url.split('/storage/v1/object/public/site-images/')
      if (parts.length >= 2) {
        await supabase.storage.from('site-images').remove([parts[1]])
      }
    }

    // 清空数据库 URL
    await supabase
      .from('site_images')
      .update({ url: null, updated_at: new Date().toISOString() })
      .eq('key', key)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
