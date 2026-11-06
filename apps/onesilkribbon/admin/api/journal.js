// /api/admin/journal —— 文章
//   GET            文章列表（服务端分页）
//   GET ?id=x      单篇文章
//   POST           { action: 'create' | 'update' | 'delete', post }
// 写入的字段和旧接口完全一样
import { supabaseAdmin as supabase } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { pageRange } from './_helpers'
import { revalidatePath } from 'next/cache'

function refreshJournal() {
  revalidatePath('/journal')
  revalidatePath('/journal/[slug]', 'page')
  revalidatePath('/sitemap.xml')
}

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (id) {
      const { data, error } = await supabase.from('journal_posts').select('*').eq('id', id).maybeSingle()
      if (error) return errorResponse(error, { tag: 'admin-journal-get-one' })
      if (!data) return Response.json({ error: '找不到这篇文章，可能已经被删除' }, { status: 404 })
      return Response.json(data)
    }

    const { page, pageSize, from, to } = pageRange(searchParams)
    const [listRes, publishedRes] = await Promise.all([
      supabase.from('journal_posts').select('*', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to),
      supabase.from('journal_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
    ])
    if (listRes.error) return errorResponse(listRes.error, { tag: 'admin-journal-get' })
    if (publishedRes.error) return errorResponse(publishedRes.error, { tag: 'admin-journal-count' })

    const total = listRes.count || 0
    return Response.json({
      posts: listRes.data || [],
      total,
      published: publishedRes.count || 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-journal-get' })
  }
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
    updated_at: new Date().toISOString(),
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
      refreshJournal()
      return Response.json({ id: data.id })
    }

    if (action === 'update') {
      const row = postRow(post)
      // 第一次发布时记下发布时间
      if (post.is_published && !post.was_published) row.published_at = new Date().toISOString()
      const { error } = await supabase.from('journal_posts').update(row).eq('id', post.id)
      if (error) return dbError(error, 'admin-journal-update')
      refreshJournal()
      return Response.json({ ok: true })
    }

    if (action === 'delete') {
      // 以前删除失败也会返回成功
      const { error } = await supabase.from('journal_posts').delete().eq('id', post.id)
      if (error) return errorResponse(error, { tag: 'admin-journal-delete', message: '删除失败，请重试' })
      refreshJournal()
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
