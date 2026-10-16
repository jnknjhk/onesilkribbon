import { supabaseAdmin as supabase } from '@osr/core/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim()
    if (!q || q.length < 2 || q.length > 100) return NextResponse.json([])
    // PostgREST rewrites even escaped * to %. Use a single-character match
    // for that character, then enforce the literal substring on returned rows.
    const pattern = `%${q.replace(/[\\%_]/g, character => '\\' + character).replace(/\*/g, '_')}%`
    const results = await Promise.all(['name', 'description', 'collection'].map(column =>
      supabase.from('products').select('id,name,slug,images,collection,description')
        .eq('is_active', true).ilike(column, pattern).limit(8)))
    if (results.some(result => result.error)) return NextResponse.json([])
    const seen = new Map()
    for (const { data } of results) {
      for (const row of data || []) {
        if (q.includes('*') && !['name', 'description', 'collection'].some(column =>
          typeof row[column] === 'string' && row[column].toLowerCase().includes(q.toLowerCase()))) continue
        if (!seen.has(row.id)) {
          const { id, name, slug, images, collection } = row
          seen.set(id, { id, name, slug, images, collection })
        }
      }
    }
    return NextResponse.json([...seen.values()].slice(0, 8))
  } catch {
    return NextResponse.json([])
  }
}
