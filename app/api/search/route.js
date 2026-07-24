import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, images, collection')
    .eq('is_active', true)
    .or(`name.ilike.%${q}%,description.ilike.%${q}%,collection.ilike.%${q}%`)
    .limit(8)

  if (error) return NextResponse.json([])
  return NextResponse.json(data || [])
}
