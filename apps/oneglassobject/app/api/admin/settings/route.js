import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { NextResponse } from 'next/server'

// POST /api/admin/settings — 后台保存运费设置。读取走公开的 GET /api/settings。
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
