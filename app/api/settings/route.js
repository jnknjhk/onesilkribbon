import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return NextResponse.json(map)
}

export async function POST(req) {
  const body = await req.json()
  const updates = Object.entries(body).map(([key, value]) => ({ key, value: String(value) }))
  for (const { key, value } of updates) {
    await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
  }
  return NextResponse.json({ ok: true })
}
