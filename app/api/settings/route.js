import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-error'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
  if (error) return errorResponse(error, { tag: 'settings-get' })
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return NextResponse.json(map)
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates = Object.entries(body).map(([key, value]) => ({ key, value: String(value) }))
  for (const { key, value } of updates) {
    await supabaseAdmin.from('settings').upsert({ key, value }, { onConflict: 'key' })
  }
  return NextResponse.json({ ok: true })
}
