// /api/admin/products
//   GET                        商品列表（服务端分页、搜索、筛选）
//   GET ?view=stock            库存列表（服务端分页、搜索、筛选）
//   GET ?id=x                  单个商品（完整字段）+ 它的全部 SKU（包括已停用的）
//   POST                       { action: 'create' | 'update' | 'delete', product, skus, deletedSkuIds }
import { supabaseAdmin as supabase } from '@osr/core/lib/supabase'
import { verifyAdmin } from '../auth'
import { errorResponse } from '@osr/core/lib/api-error'
import { cleanSearch, pageRange, readSettings } from './_helpers'
import { parseStockQuantity } from '../lib/stock-quantity'
import { revalidateCatalog } from '../lib/revalidate'

const DEFAULT_LOW_STOCK = 3

async function lowStockThreshold() {
  try {
    const settings = await readSettings(supabase, ['low_stock_threshold'])
    const value = parseInt(settings.low_stock_threshold, 10)
    return Number.isFinite(value) ? value : DEFAULT_LOW_STOCK
  } catch {
    return DEFAULT_LOW_STOCK
  }
}

function summarizeProduct(product, skus, threshold) {
  const list = skus || []
  const active = list.filter(k => k.is_active !== false)
  const prices = active.map(k => parseFloat(k.price_gbp)).filter(Number.isFinite)
  return {
    ...product,
    sku_count: list.length,
    stock_total: active.reduce((n, k) => n + (k.stock_qty || 0), 0),
    out_count: active.filter(k => (k.stock_qty || 0) <= 0).length,
    low_count: active.filter(k => (k.stock_qty || 0) > 0 && (k.stock_qty || 0) <= threshold).length,
    min_price: prices.length ? Math.min(...prices) : null,
    max_price: prices.length ? Math.max(...prices) : null,
  }
}

async function productList(searchParams, threshold) {
  const { page, pageSize, from, to } = pageRange(searchParams)
  const q = cleanSearch(searchParams.get('q'))
  const collection = searchParams.get('collection') || ''
  const status = searchParams.get('status') || ''

  let query = supabase.from('products')
    .select('id, name, slug, collection, images, is_active, is_featured, created_at', { count: 'exact' })
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
  if (collection) query = query.eq('collection', collection)
  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  const { data, error, count } = await query
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(from, to)
  if (error) return errorResponse(error, { tag: 'admin-products-list' })

  const ids = (data || []).map(p => p.id)
  let skus = []
  if (ids.length) {
    const res = await supabase.from('product_skus')
      .select('product_id, stock_qty, price_gbp, is_active').in('product_id', ids)
    if (res.error) return errorResponse(res.error, { tag: 'admin-products-list-skus' })
    skus = res.data || []
  }
  const byProduct = {}
  for (const sku of skus) (byProduct[sku.product_id] ||= []).push(sku)
  const total = count || 0
  return Response.json({
    products: (data || []).map(p => summarizeProduct(p, byProduct[p.id], threshold)),
    total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    lowStockThreshold: threshold,
  })
}

async function stockList(searchParams, threshold) {
  const { page, pageSize, from, to } = pageRange(searchParams)
  const q = cleanSearch(searchParams.get('q'))
  const filter = searchParams.get('filter') || ''

  let query = supabase.from('product_skus')
    .select('id, product_id, colour, colour_hex, attributes, stock_qty, price_gbp, is_active, sku_code, products!inner(name, is_active)', { count: 'exact' })
  if (filter === 'low' || filter === 'out') {
    query = query.eq('is_active', true).eq('products.is_active', true)
    query = filter === 'out' ? query.lte('stock_qty', 0) : query.lte('stock_qty', threshold)
  }
  if (q) {
    const { data: matchedProducts, error } = await supabase.from('products')
      .select('id').or(`name.ilike.%${q}%,slug.ilike.%${q}%`).limit(100)
    if (error) return errorResponse(error, { tag: 'admin-stock-search-products' })
    const clauses = [`colour.ilike.%${q}%`, `sku_code.ilike.%${q}%`]
    const ids = (matchedProducts || []).map(p => p.id)
    if (ids.length) clauses.push(`product_id.in.(${ids.join(',')})`)
    query = query.or(clauses.join(','))
  }

  const { data, error, count } = await query
    .order('sku_code').order('id').range(from, to)
  if (error) return errorResponse(error, { tag: 'admin-stock-list' })
  const total = count || 0
  return Response.json({
    skus: data || [], total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    lowStockThreshold: threshold,
  })
}

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (id) {
      const [{ data: product, error }, { data: skus, error: skuError }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_skus').select('*').eq('product_id', id).order('created_at').order('id'),
      ])
      if (error || skuError) return errorResponse(error || skuError, { tag: 'admin-products-get-one' })
      if (!product) return Response.json({ error: '找不到这个商品，可能已经被删除' }, { status: 404 })
      return Response.json({ product, skus: skus || [] })
    }

    const threshold = await lowStockThreshold()
    return searchParams.get('view') === 'stock'
      ? await stockList(searchParams, threshold)
      : await productList(searchParams, threshold)
  } catch (err) {
    return errorResponse(err, { tag: 'admin-products-get' })
  }
}

function atomicProductError(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`
  if (error?.code === '23505') {
    if (/slug/i.test(text)) return Response.json({ error: '这个商品网址已经被另一个商品用了，请换一个' }, { status: 409 })
    return Response.json({ error: '商品或 SKU 编码重复，请重试' }, { status: 409 })
  }
  if (text.includes('product_not_found')) return Response.json({ error: '商品不存在，请刷新后重试' }, { status: 404 })
  if (text.includes('stock_conflict')) return Response.json({ error: '规格或库存已被其他操作修改，请刷新后检查，避免覆盖新订单库存' }, { status: 409 })
  if (text.includes('sku_not_found') || text.includes('sku_conflict')) return Response.json({ error: '规格已变化或不属于此商品，请刷新后检查' }, { status: 409 })
  if (text.includes('sku_duplicate') || text.includes('invalid_')) return Response.json({ error: '规格列表有无效或重复记录，请刷新后重试' }, { status: 400 })
  return errorResponse(error, { tag: 'admin-products-atomic' })
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: '无效的商品信息' }, { status: 400 })
    const { action, product, skus, deletedSkuIds } = body
    if (!product || typeof product !== 'object' || Array.isArray(product) ||
        (action !== 'create' && (typeof product.id !== 'string' || !product.id))) {
      return Response.json({ error: '无效的商品信息' }, { status: 400 })
    }
    if (action === 'create' || action === 'update') {
      if (!Array.isArray(skus) || skus.length > 2000 ||
          (deletedSkuIds !== undefined && (!Array.isArray(deletedSkuIds) || deletedSkuIds.length > 2000))) {
        return Response.json({ error: '规格列表不完整，请刷新后重试' }, { status: 400 })
      }
      const ids = new Set()
      for (const sku of skus) {
        if (!sku || typeof sku !== 'object' || Array.isArray(sku) ||
            (sku.id != null && (typeof sku.id !== 'string' || !sku.id || ids.has(sku.id)))) {
          return Response.json({ error: '规格列表有无效或重复记录，请刷新后重试' }, { status: 400 })
        }
        if (sku.id) ids.add(sku.id)
        if (sku.id && !Object.hasOwn(sku, 'loaded_stock_qty')) {
          return Response.json({ error: '缺少加载时的库存，请刷新商品页面后再保存' }, { status: 409 })
        }
        const price = Number(sku.price_gbp)
        if (!['number', 'string'].includes(typeof sku.price_gbp) || String(sku.price_gbp).trim() === '' ||
            !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
            (parseStockQuantity(sku.stock_qty) === null && !(sku.id && sku.stock_qty === null && sku.loaded_stock_qty === null)) ||
            (Object.hasOwn(sku, 'loaded_stock_qty') && sku.loaded_stock_qty !== null && parseStockQuantity(sku.loaded_stock_qty, { allowNegative: true }) === null)) {
          return Response.json({ error: '规格价格或库存无效；库存请填写 0 或正整数' }, { status: 400 })
        }
      }
      if ((deletedSkuIds || []).some(id => typeof id !== 'string' || !id || ids.has(id))) {
        return Response.json({ error: '待删除规格与保存列表冲突，请刷新后重试' }, { status: 400 })
      }

      // 2026-11-06-product-save-atomic.sql 已应用到所有环境；数据库事务是唯一保存路径。
      // 新建时不能把调用方误传的 id 带进去，否则 RPC 会把它当成更新。
      const rpcProduct = action === 'create'
        ? Object.fromEntries(Object.entries(product).filter(([key]) => key !== 'id'))
        : product
      const { data, error } = await supabase.rpc('admin_save_product', {
        p_product: rpcProduct,
        p_skus: skus || [],
        p_deleted_sku_ids: [...new Set(deletedSkuIds || [])],
      })
      if (error) return atomicProductError(error)
      if (action === 'create') {
        if (!data?.id) return errorResponse(new Error('Product save returned no id'), { tag: 'admin-products-atomic' })
        return Response.json({ id: data.id })
      }
      return Response.json({ ok: true, deleted: data?.deleted || 0, deactivated: data?.deactivated || 0 })
    }

    if (action === 'delete') {
      const { data, error } = await supabase.rpc('admin_delete_product', { p_product_id: product.id })
      if (error) return atomicProductError(error)
      if (data?.softDeleted) {
        return Response.json({
          ok: true, softDeleted: true,
          message: `这个商品有 ${data.orderItemCount} 条历史订单记录，已改为下架而不是删除，订单历史保留完整。`,
        })
      }
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-products-post' })
  } finally {
    // 商品、价格、库存、图片、上下架都可能影响前台；统一失效，避免每个分支漏掉。
    try { revalidateCatalog() } catch {}
  }
}
