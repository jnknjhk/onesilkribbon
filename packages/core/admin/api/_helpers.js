// 后台接口共用的服务端工具（只在 route handler 里用，不要在浏览器端引用）

// 把一条查询分页取完。Supabase（PostgREST）每次请求最多返回 1000 行（项目设置里的 Max rows），
// 超出的部分会被**静默截断**——之前仪表盘、订单列表、SKU 列表都踩在这个坑上：数据一多，
// 统计数字会悄悄算少。
//
// makeQuery(opts) 每次调用都要返回一条新的、带稳定排序（含唯一列做兜底）的查询，并把 opts
// 原样传给 .select(列, opts)：第一页顺带要回总行数，取够就停，不用再多发一次"空页"确认
// （每多一次往返，线上就多等几百毫秒）；剩下的页并行取。
// 没把 opts 传给 select 的旧写法也能用，只是退回一页一页取到空页为止。
export async function fetchAll(makeQuery, { pageSize = 1000, maxPages = 500 } = {}) {
  const first = await makeQuery({ count: 'exact' }).range(0, pageSize - 1)
  if (first.error) return { data: [], error: first.error }
  const out = [...(first.data || [])]
  if (out.length === 0) return { data: out, error: null }

  if (typeof first.count === 'number') {
    if (out.length >= first.count) return { data: out, error: null }
    // 每页实际给多少行以第一页为准：项目设置的上限可能比 pageSize 小
    const step = out.length
    const starts = []
    for (let from = step; from < first.count && starts.length < maxPages; from += step) starts.push(from)
    for (let i = 0; i < starts.length; i += 4) { // 最多 4 页同时取
      const pages = await Promise.all(starts.slice(i, i + 4).map(from => makeQuery().range(from, from + step - 1)))
      for (const p of pages) {
        if (p.error) return { data: out, error: p.error }
        out.push(...(p.data || []))
      }
    }
    if (out.length >= first.count) return { data: out, error: null }
    // 取的过程中又有新行插进来：接着往下一页一页取
  }

  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await makeQuery().range(out.length, out.length + pageSize - 1)
    if (error) return { data: out, error }
    if (!data || data.length === 0) break
    out.push(...data)
  }
  return { data: out, error: null }
}

// 把订单商品的数量加回库存（退款时可选）。
// 用"比较后再写"：只有库存还是刚读到的那个数时才更新，否则重读重试——
// 避免和同时进来的订单扣库存互相覆盖。库存是 null 的 SKU 按 0 处理。
export async function restockItems(supabase, items) {
  const results = []
  for (const item of items || []) {
    const skuId = item.sku_id
    const qty = parseInt(item.quantity, 10) || 0
    if (!skuId || qty <= 0) continue
    let ok = false
    for (let attempt = 0; attempt < 5 && !ok; attempt++) {
      const { data: sku, error: readErr } = await supabase
        .from('product_skus').select('stock_qty').eq('id', skuId).maybeSingle()
      if (readErr || !sku) break
      const current = sku.stock_qty
      let q = supabase.from('product_skus').update({ stock_qty: (current || 0) + qty }).eq('id', skuId)
      q = current === null ? q.is('stock_qty', null) : q.eq('stock_qty', current)
      const { data: updated, error } = await q.select('id')
      ok = !error && Array.isArray(updated) && updated.length > 0
    }
    results.push({ skuId, qty, ok })
  }
  return results
}

// 后台搜索词拼进 PostgREST 的 .or() 过滤串之前，去掉会破坏语法的字符
export function cleanSearch(q) {
  return String(q || '').replace(/[,()"\\%*]/g, ' ').trim().slice(0, 100)
}

// "今天 / 近 7 天"按英国时间算——店在英国，凌晨的订单应该算当天
const londonDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
export function dayKey(dateLike) {
  return londonDay.format(new Date(dateLike))
}

export async function readSettings(supabase, keys) {
  let q = supabase.from('settings').select('key, value')
  if (keys) q = q.in('key', keys)
  const { data } = await q
  return Object.fromEntries((data || []).map(r => [r.key, r.value]))
}
