// /api/admin/products —— 两个站共用
//   GET           商品列表 + 全部 SKU（分页取完，不再有 5000 / 20000 的截断上限）
//   GET ?id=x     单个商品（完整字段）+ 它的全部 SKU（包括已停用的）
//   POST          { action: 'create' | 'update' | 'delete', product, skus, deletedSkuIds }
import { supabaseAdmin as supabase } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'
import { recordSlugChange } from '../../lib/product-redirects'
import { parseStockQuantity } from '../lib/stock-quantity'

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      const [{ data: product, error }, { data: skus, error: skuError }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_skus').select('*').eq('product_id', id).order('created_at').order('id'),
      ])
      if (error || skuError) return errorResponse(error || skuError, { tag: 'admin-products-get-one' })
      if (!product) return Response.json({ error: '找不到这个商品，可能已经被删除' }, { status: 404 })
      return Response.json({ product, skus: skus || [] })
    }

    // 列表只取渲染要用的列（description 是长文本，列表里用不到）
    const [products, skus] = await Promise.all([
      fetchAll(() => supabase.from('products')
        .select('id, name, slug, collection, images, attribute_config, is_active, is_featured, sort_order, created_at')
        .order('created_at', { ascending: false }).order('id')),
      fetchAll(() => supabase.from('product_skus')
        .select('id, product_id, colour, colour_hex, attributes, stock_qty, price_gbp, is_active, sku_code')
        .order('product_id').order('id')),
    ])
    if (products.error || skus.error) return errorResponse(products.error || skus.error, { tag: 'admin-products-get' })
    return Response.json({ products: products.data, skus: skus.data, total: products.data.length })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-products-get' })
  }
}

function skuRow(sku, productId, slug) {
  return {
    product_id: productId,
    colour: sku.colour || sku.attributes?.['颜色'] || sku.attributes?.['Colour'] || sku.attributes?.['Color'] || '默认',
    colour_hex: sku.colour_hex || '#D4C5B0',
    width_mm: sku.width_mm ? parseInt(sku.width_mm) : null,
    length_m: sku.length_m ? parseInt(sku.length_m) : null,
    price_gbp: Number(sku.price_gbp),
    stock_qty: parseStockQuantity(sku.stock_qty) ?? 0,
    is_active: sku.is_active !== false,
    attributes: sku.attributes || {},
    // 以前新建/复制商品时这一项没写进去，SKU 上选好的图片会丢
    images: sku.images || [],
    ...(slug ? { sku_code: `${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` } : {}),
  }
}

function productRow(product) {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    collection: product.collection,
    is_active: product.is_active,
    is_featured: product.is_featured || false,
    sort_order: parseInt(product.sort_order) || 0,
    images: product.images || [],
    attribute_config: product.attribute_config || [],
    specifications: product.specifications || [],
  }
}

// 删除 SKU：有订单记录的 SKU 不能真删（订单明细引用着它，数据库会拒绝，以前这个错误被忽略，
// 结果 SKU 既没删掉也没停用）。改成：有订单的停用，没有订单的才删除。
async function removeSkus(ids) {
  if (!ids.length) return { deleted: 0, deactivated: 0 }
  const { data: used, error: lookupError } = await supabase.from('order_items').select('sku_id').in('sku_id', ids)
  if (lookupError) throw lookupError
  const usedSet = new Set((used || []).map(r => r.sku_id))
  const toDeactivate = ids.filter(id => usedSet.has(id))
  const toDelete = ids.filter(id => !usedSet.has(id))
  if (toDeactivate.length) {
    const { error } = await supabase.from('product_skus').update({ is_active: false }).in('id', toDeactivate)
    if (error) throw error
  }
  if (toDelete.length) {
    const { error } = await supabase.from('product_skus').delete().in('id', toDelete)
    if (error) throw error
  }
  return { deleted: toDelete.length, deactivated: toDeactivate.length }
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
    }

    if (action === 'create') {
      const { data, error } = await supabase.from('products').insert(productRow(product)).select('id').single()
      if (error) return errorResponse(error, { tag: 'admin-products-create' })
      for (const sku of skus || []) {
        const { error: skuErr } = await supabase.from('product_skus').insert(skuRow(sku, data.id, product.slug))
        if (skuErr) return errorResponse(skuErr, { tag: 'admin-products-create-sku', message: '商品已创建，但有 SKU 没保存成功，请打开商品检查' })
      }
      return Response.json({ id: data.id })
    }

    if (action === 'update') {
      const { data: before, error: beforeError } = await supabase.from('products').select('slug').eq('id', product.id).maybeSingle()
      if (beforeError) throw beforeError
      if (!before) return Response.json({ error: '商品不存在，请刷新后重试' }, { status: 404 })
      const { data: existingSkus, error: existingError } = await supabase.from('product_skus').select('id').eq('product_id', product.id)
      if (existingError) throw existingError
      const existingIds = new Set((existingSkus || []).map(row => row.id))
      if ([...(deletedSkuIds || []), ...(skus || []).filter(row => row.id).map(row => row.id)].some(id => !existingIds.has(id))) {
        return Response.json({ error: '规格已变化或不属于此商品，请刷新后检查' }, { status: 409 })
      }
      const { error } = await supabase.from('products').update(productRow(product)).eq('id', product.id)
      if (error) return errorResponse(error, { tag: 'admin-products-update' })

      // 网址改了：记下旧网址，前台访问旧链接时 301 到新网址（存进 settings 表，不需要新建表）
      if (before?.slug && before.slug !== product.slug) {
        await recordSlugChange(supabase, before.slug, product.slug, product.id)
      }

      // Only explicitly deleted SKUs may be removed. An older editor does not
      // know about SKUs created by another operator after it was opened.
      const submitted = skus || []
      const removeIds = [...new Set(deletedSkuIds || [])]
      const removed = await removeSkus(removeIds)

      for (const sku of submitted) {
        if (sku.id) {
          const row = skuRow(sku, product.id)
          // 库存只在管理员真的改过时才写。编辑器打开期间如果有订单付款，webhook 已经把库存
          // 扣掉了；这时候再把打开编辑器那一刻的旧数字原样写回去，就等于把卖掉的又加回来，
          // 接着就会超卖。前端会带上 loaded_stock_qty（加载时的库存），两者相同说明没动过。
          if ((parseStockQuantity(sku.stock_qty) ?? 0) === (parseStockQuantity(sku.loaded_stock_qty, { allowNegative: true }) ?? 0)) {
            delete row.stock_qty
          }
          let update = supabase.from('product_skus').update(row).eq('id', sku.id).eq('product_id', product.id)
          // If stock was deliberately edited, compare with the value originally
          // loaded. A checkout that happened meanwhile must not be overwritten.
          if ('stock_qty' in row) update = sku.loaded_stock_qty === null
            ? update.is('stock_qty', null) : update.eq('stock_qty', parseStockQuantity(sku.loaded_stock_qty, { allowNegative: true }))
          const { data: savedSku, error: skuErr } = await update.select('id').maybeSingle()
          if (skuErr) return errorResponse(skuErr, { tag: 'admin-products-update-sku', message: '商品信息已保存，但有 SKU 没保存成功，请刷新后检查' })
          if (!savedSku) return Response.json({ error: '规格或库存已被其他操作修改，请刷新后检查，避免覆盖新订单库存' }, { status: 409 })
        } else {
          const { error: skuErr } = await supabase.from('product_skus').insert(skuRow(sku, product.id, product.slug))
          if (skuErr) return errorResponse(skuErr, { tag: 'admin-products-insert-sku', message: '商品信息已保存，但新加的 SKU 没保存成功，请刷新后检查' })
        }
      }
      return Response.json({ ok: true, ...removed })
    }

    if (action === 'delete') {
      // 有历史订单的商品不物理删除，改为下架 + 停用全部 SKU，保留订单数据完整
      const { count: orderItemCount, error: historyError } = await supabase
        .from('order_items').select('*', { count: 'exact', head: true }).eq('product_id', product.id)
      if (historyError) throw historyError
      if (!Number.isInteger(orderItemCount)) throw new Error('Unable to verify product history')
      if (orderItemCount && orderItemCount > 0) {
        const skuResult = await supabase.from('product_skus').update({ is_active: false }).eq('product_id', product.id)
        if (skuResult.error) throw skuResult.error
        const productResult = await supabase.from('products').update({ is_active: false }).eq('id', product.id)
        if (productResult.error) throw productResult.error
        return Response.json({
          ok: true, softDeleted: true,
          message: `这个商品有 ${orderItemCount} 条历史订单记录，已改为下架而不是删除，订单历史保留完整。`,
        })
      }
      const skuResult = await supabase.from('product_skus').delete().eq('product_id', product.id)
      if (skuResult.error) throw skuResult.error
      const productResult = await supabase.from('products').delete().eq('id', product.id)
      if (productResult.error) throw productResult.error
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-products-post' })
  }
}
