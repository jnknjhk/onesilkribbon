// /api/admin/products —— 两个站共用
//   GET           商品列表 + 全部 SKU（分页取完，不再有 5000 / 20000 的截断上限）
//   GET ?id=x     单个商品（完整字段）+ 它的全部 SKU（包括已停用的）
//   POST          { action: 'create' | 'update' | 'delete', product, skus, deletedSkuIds }
import { supabaseAdmin as supabase } from '../../lib/supabase'
import { verifyAdmin } from '../../lib/admin-auth'
import { errorResponse } from '../../lib/api-error'
import { fetchAll } from './_helpers'
import { recordSlugChange } from '../../lib/product-redirects'

export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      const [{ data: product, error }, { data: skus }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_skus').select('*').eq('product_id', id).order('created_at').order('id'),
      ])
      if (error) return errorResponse(error, { tag: 'admin-products-get-one' })
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
    if (products.error) return errorResponse(products.error, { tag: 'admin-products-get' })
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
    price_gbp: parseFloat(sku.price_gbp) || 0,
    stock_qty: parseInt(sku.stock_qty) || 0,
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
  const { data: used } = await supabase.from('order_items').select('sku_id').in('sku_id', ids)
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
    const { action, product, skus, deletedSkuIds } = await req.json()

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
      const { data: before } = await supabase.from('products').select('slug').eq('id', product.id).maybeSingle()
      const { error } = await supabase.from('products').update(productRow(product)).eq('id', product.id)
      if (error) return errorResponse(error, { tag: 'admin-products-update' })

      // 网址改了：记下旧网址，前台访问旧链接时 301 到新网址（存进 settings 表，不需要新建表）
      if (before?.slug && before.slug !== product.slug) {
        await recordSlugChange(supabase, before.slug, product.slug, product.id)
      }

      // 要删的 SKU = 前端标记删除的 + 数据库里有、但这次提交的列表里没有的
      const submitted = skus || []
      const keepIds = new Set(submitted.filter(s => s.id).map(s => s.id))
      let removeIds = [...new Set(deletedSkuIds || [])]
      if (submitted.length > 0) {
        const { data: existing } = await supabase.from('product_skus').select('id').eq('product_id', product.id)
        for (const row of existing || []) if (!keepIds.has(row.id)) removeIds.push(row.id)
      }
      removeIds = [...new Set(removeIds)].filter(id => !keepIds.has(id))
      const removed = await removeSkus(removeIds)

      for (const sku of submitted) {
        if (sku.id) {
          const row = skuRow(sku, product.id)
          // 库存只在管理员真的改过时才写。编辑器打开期间如果有订单付款，webhook 已经把库存
          // 扣掉了；这时候再把打开编辑器那一刻的旧数字原样写回去，就等于把卖掉的又加回来，
          // 接着就会超卖。前端会带上 loaded_stock_qty（加载时的库存），两者相同说明没动过。
          // 老版本的后台页面不带这个字段，就照旧写入。
          if ('loaded_stock_qty' in sku &&
              (parseInt(sku.stock_qty, 10) || 0) === (parseInt(sku.loaded_stock_qty, 10) || 0)) {
            delete row.stock_qty
          }
          const { error: skuErr } = await supabase.from('product_skus').update(row).eq('id', sku.id)
          if (skuErr) return errorResponse(skuErr, { tag: 'admin-products-update-sku', message: '商品信息已保存，但有 SKU 没保存成功，请刷新后检查' })
        } else {
          const { error: skuErr } = await supabase.from('product_skus').insert(skuRow(sku, product.id, product.slug))
          if (skuErr) return errorResponse(skuErr, { tag: 'admin-products-insert-sku', message: '商品信息已保存，但新加的 SKU 没保存成功，请刷新后检查' })
        }
      }
      return Response.json({ ok: true, ...removed })
    }

    if (action === 'delete') {
      // 有历史订单的商品不物理删除，改为下架 + 停用全部 SKU，保留订单数据完整
      const { count: orderItemCount } = await supabase
        .from('order_items').select('*', { count: 'exact', head: true }).eq('product_id', product.id)
      if (orderItemCount && orderItemCount > 0) {
        await supabase.from('product_skus').update({ is_active: false }).eq('product_id', product.id)
        await supabase.from('products').update({ is_active: false }).eq('id', product.id)
        return Response.json({
          ok: true, softDeleted: true,
          message: `这个商品有 ${orderItemCount} 条历史订单记录，已改为下架而不是删除，订单历史保留完整。`,
        })
      }
      await supabase.from('product_skus').delete().eq('product_id', product.id)
      await supabase.from('products').delete().eq('id', product.id)
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-products-post' })
  }
}
