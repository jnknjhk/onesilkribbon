import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const productId = formData.get('productId')

    if (!file || !productId) {
      return NextResponse.json({ error: 'Missing file or productId' }, { status: 400 })
    }

    // 生成唯一文件名
    const ext = file.name.split('.').pop().toLowerCase()
    const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    // 上传到 Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 删除图片
export async function DELETE(req) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // 从 URL 中提取文件路径
    const parts = url.split('/storage/v1/object/public/products/')
    if (parts.length < 2) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

    const filePath = parts[1]
    const { error } = await supabase.storage
      .from('products')
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
