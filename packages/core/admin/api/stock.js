// PATCH /api/admin/stock —— 库存视图里直接改数字用（两个站共用）
// body: { updates: [{ id, stock_qty, expected }] }
//
// 只改 product_skus.stock_qty 这一个字段，不走"保存整个商品"那条路（那条路会删除
// 提交列表里没有的 SKU，拿来改库存太危险）。
// expected 是页面加载时看到的库存：数据库里的值已经变了（比如刚有订单扣了库存），
// 这一行就不改，返回最新值让页面提示，避免把别人刚扣掉的库存覆盖回去。
import { supabaseAdmin } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'

export async function PATCH(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { updates } = await req.json()
    if (!Array.isArray(updates) || updates.length === 0) {
      return Response.json({ error: '没有要保存的修改' }, { status: 400 })
    }
    if (updates.length > 500) return Response.json({ error: '一次最多改 500 个 SKU' }, { status: 400 })

    const results = []
    for (const u of updates) {
      const qty = Number(u.stock_qty)
      if (!u.id || !Number.isInteger(qty) || qty < 0) {
        results.push({ id: u.id, ok: false, error: '库存必须是 0 或正整数' })
        continue
      }
      let q = supabaseAdmin.from('product_skus').update({ stock_qty: qty }).eq('id', u.id)
      if (u.expected !== undefined) {
        q = u.expected === null ? q.is('stock_qty', null) : q.eq('stock_qty', Number(u.expected))
      }
      const { data, error } = await q.select('id, stock_qty')
      if (error) { results.push({ id: u.id, ok: false, error: '保存失败' }); continue }
      if (data && data.length > 0) { results.push({ id: u.id, ok: true, stock_qty: data[0].stock_qty }); continue }

      // 没有更新到：要么 SKU 不存在，要么库存在你打开页面之后被改过了
      const { data: current } = await supabaseAdmin.from('product_skus').select('stock_qty').eq('id', u.id).maybeSingle()
      results.push(current
        ? { id: u.id, ok: false, conflict: true, current: current.stock_qty, error: `库存已变成 ${current.stock_qty ?? 0}（期间可能有新订单），请确认后再改` }
        : { id: u.id, ok: false, error: '找不到这个 SKU' })
    }
    return Response.json({ results })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-stock-patch' })
  }
}
