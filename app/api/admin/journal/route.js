import { supabaseAdmin as supabase } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-error'

// 获取所有文章
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return errorResponse(error, { tag: 'admin-journal-get' })
  return NextResponse.json(data)
}

// 新建 / 更新 / 删除文章
export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
      if (error) return errorResponse(error, { tag: 'admin-journal-create' })
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
      if (error) return errorResponse(error, { tag: 'admin-journal-update' })
      return NextResponse.json({ ok: true })

    } else if (action === 'delete') {
      await supabase.from('journal_posts').delete().eq('id', post.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-journal-post' })
  }
}
