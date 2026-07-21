import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('coupons').select('*').order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ coupons: data || [] })
}

// body: { action:'create'|'update', payload, id? }
export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { action, payload, id } = await req.json()

    if (action === 'create') {
      const { error } = await supabaseAdmin.from('coupons').insert(payload)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true })
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      const { error } = await supabaseAdmin.from('coupons').update(payload).eq('id', id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// body: { id, active }
export async function PATCH(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, active } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin.from('coupons').update({ active }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin.from('coupons').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
