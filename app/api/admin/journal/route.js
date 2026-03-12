import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// 获取所有文章
export async function GET() {
  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 新建 / 更新 / 删除文章
export async function POST(req) {
  try {
    const body = await req.json()
    const { action, post } = body

    if (action === 'create') {
      const { data, error } = await supabase
        .from('journal_posts')
        .insert({
          title: post.title,
          slug: post.slug,
          category: post.category,
          excerpt: post.excerpt,
          intro: post.intro,
          cover_image: post.cover_image || null,
          sections: post.sections || [],
          closing: post.closing || '',
          read_time: post.read_time || '3 min read',
          is_published: post.is_published,
          published_at: post.is_published ? new Date().toISOString() : null,
        })
        .select('id')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ id: data.id })

    } else if (action === 'update') {
      const updateData = {
        title: post.title,
        slug: post.slug,
        category: post.category,
        excerpt: post.excerpt,
        intro: post.intro,
        cover_image: post.cover_image || null,
        sections: post.sections || [],
        closing: post.closing || '',
        read_time: post.read_time || '3 min read',
        is_published: post.is_published,
      }
      // 首次发布时记录时间
      if (post.is_published && !post.was_published) {
        updateData.published_at = new Date().toISOString()
      }
      const { error } = await supabase
        .from('journal_posts')
        .update(updateData)
        .eq('id', post.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })

    } else if (action === 'delete') {
      await supabase.from('journal_posts').delete().eq('id', post.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
