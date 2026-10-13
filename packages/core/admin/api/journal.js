// /api/admin/journal —— 文章（目前只有 One Silk Ribbon 有）
//   GET    全部文章
//   POST   { action: 'create' | 'update' | 'delete', post }
// 写入的字段和旧接口完全一样
import { supabaseAdmin as supabase } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // ?id=x：只取一篇（编辑页用）
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const { data, error } = await supabase.from('journal_posts').select('*').eq('id', id).maybeSingle()
    if (error) return errorResponse(error, { tag: 'admin-journal-get-one' })
    if (!data) return Response.json({ error: '找不到这篇文章，可能已经被删除' }, { status: 404 })
    return Response.json(data)
  }
  const { data, error } = await fetchAll(o => supabase.from('journal_posts').select('*', o)
    .order('created_at', { ascending: false }).order('id'))
  if (error) return errorResponse(error, { tag: 'admin-journal-get' })
  return Response.json(data)
}

function postRow(post) {
  return {
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
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { action, post } = await req.json()

    if (action === 'create') {
      const { data, error } = await supabase.from('journal_posts')
        .insert({ ...postRow(post), published_at: post.is_published ? new Date().toISOString() : null })
        .select('id').single()
      if (error) return dbError(error, 'admin-journal-create')
      return Response.json({ id: data.id })
    }

    if (action === 'update') {
      const row = postRow(post)
      // 第一次发布时记下发布时间
      if (post.is_published && !post.was_published) row.published_at = new Date().toISOString()
      const { error } = await supabase.from('journal_posts').update(row).eq('id', post.id)
      if (error) return dbError(error, 'admin-journal-update')
      return Response.json({ ok: true })
    }

    if (action === 'delete') {
      // 以前删除失败也会返回成功
      const { error } = await supabase.from('journal_posts').delete().eq('id', post.id)
      if (error) return errorResponse(error, { tag: 'admin-journal-delete', message: '删除失败，请重试' })
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-journal-post' })
  }
}

function dbError(error, tag) {
  if (error.code === '23505') return Response.json({ error: '这个网址已经被另一篇文章用了，请换一个' }, { status: 409 })
  return errorResponse(error, { tag })
}
