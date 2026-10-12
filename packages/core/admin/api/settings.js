// /api/admin/settings —— 两个站共用
//   GET   全部设置项（只有后台能看；前台读运费走公开的 /api/settings，只返回那三项）
//   POST  { key: value, ... } 写入，没有的键会新建
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { readSettings } from './_helpers'

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return Response.json({ settings: await readSettings(supabaseAdmin) })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-settings-get' })
  }
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const rows = Object.entries(body || {}).map(([key, value]) => ({ key, value: String(value) }))
    if (rows.length === 0) return Response.json({ error: '没有要保存的设置' }, { status: 400 })
    // 以前逐条写、错误不检查，后台照样显示"已保存"。现在一次写完，失败就报错
    const { error } = await supabaseAdmin.from('settings').upsert(rows, { onConflict: 'key' })
    if (error) return errorResponse(error, { tag: 'admin-settings-post', message: '保存失败，请重试' })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-settings-post' })
  }
}
