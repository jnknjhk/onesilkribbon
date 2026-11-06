// 后台接口共用的服务端工具（只在 route handler 里用，不要在浏览器端引用）

// 把一条查询分页取完。Supabase（PostgREST）每次请求最多返回 1000 行（项目设置里的 Max rows），
// 超出的部分会被**静默截断**——之前仪表盘、订单列表、SKU 列表都踩在这个坑上：数据一多，
// 统计数字会悄悄算少。这里一直取到返回空页为止，不依赖服务器的上限具体是多少。
//
// makeQuery 每次调用都要返回一条新的、带稳定排序（含唯一列做兜底）的查询。
export async function fetchAll(makeQuery, { pageSize = 1000, maxPages = 500 } = {}) {
  const out = []
  let from = 0
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) return { data: out, error }
    if (!Array.isArray(data)) return { data: out, error: new Error('Invalid paginated response') }
    if (data.length === 0) return { data: out, error: null }
    out.push(...data)
    from += data.length
  }
  return { data: out, error: new Error('Pagination safety limit reached; result is incomplete') }
}

// 后台搜索词拼进 PostgREST 的 .or() 过滤串之前，去掉会破坏语法的字符
export function cleanSearch(q) {
  return String(q || '').replace(/[,()"\\%*]/g, ' ').trim().slice(0, 100)
}

// 列表接口统一的分页参数。默认每页 30 条，最多 100 条。
export function pageRange(searchParams, { defaultSize = 30, maxSize = 100 } = {}) {
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(searchParams.get('pageSize'), 10) || defaultSize))
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 }
}

// "今天 / 近 7 天"按英国时间算——店在英国，凌晨的订单应该算当天
const londonDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
export function dayKey(dateLike) {
  return londonDay.format(new Date(dateLike))
}

export async function readSettings(supabase, keys) {
  let q = supabase.from('settings').select('key, value')
  if (keys) q = q.in('key', keys)
  const { data, error } = await q
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Invalid settings response')
  return Object.fromEntries(data.map(r => [r.key, r.value]))
}
