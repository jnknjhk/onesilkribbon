// 商品改了网址（slug）之后，旧链接（搜索引擎收录的、顾客收藏的、发出去的）不能变成 404。
// 后台保存时把"旧 slug → 商品 id"记在 settings 表的一个键里（不需要建新表），
// 前台找不到商品时查一下这里，找到就 301 到商品现在的网址。
const KEY = 'product_slug_redirects'

async function readMap(supabase) {
  const { data } = await supabase.from('settings').select('value').eq('key', KEY).maybeSingle()
  try {
    const map = JSON.parse(data?.value || '{}')
    return map && typeof map === 'object' ? map : {}
  } catch {
    return {}
  }
}

export async function recordSlugChange(supabase, oldSlug, newSlug, productId) {
  if (!oldSlug || oldSlug === newSlug) return
  const map = await readMap(supabase)
  map[oldSlug] = productId
  // 改回以前用过的网址时，去掉那条记录，免得自己重定向到自己
  delete map[newSlug]
  const { error } = await supabase.from('settings').upsert({ key: KEY, value: JSON.stringify(map) }, { onConflict: 'key' })
  if (error) console.error('[product-redirects] 记录旧网址失败（不影响商品保存）:', error.message)
}

// 返回 { slug, collection }，找不到或商品已下架时返回 null
export async function findRenamedProduct(supabase, slug) {
  const map = await readMap(supabase)
  const id = map[slug]
  if (!id) return null
  const { data } = await supabase.from('products').select('slug, collection, is_active').eq('id', id).maybeSingle()
  return data && data.is_active !== false && data.slug !== slug ? data : null
}
