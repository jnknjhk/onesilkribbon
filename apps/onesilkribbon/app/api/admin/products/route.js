import { supabaseAdmin as supabase } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { NextResponse } from 'next/server'
import { errorResponse } from '@osr/core/lib/api-error'

const PRODUCTS_CAP = 5000
const SKUS_CAP = 20000

// 获取产品（?id=xxx 拿单个产品+其全部 SKU，否则拿产品列表+全部 SKU）
// 全部用 service role 查，不受 product_skus 的 "is_active=true 才公开可见" 这条 RLS 限制——
// 之前前端直接用 anon key 查 product_skus，后台会看不到已下架 SKU 的库存/价格
export async function GET(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const { data: product, error } = await supabase.from('products').select('*').eq('id', id).single()
    if (error) return errorResponse(error, { tag: 'admin-products-get-one' })
    const { data: skus } = await supabase.from('product_skus').select('*').eq('product_id', id)
    return NextResponse.json({ product, skus: skus || [] })
  }

  // 兜底上限，防止商品/SKU量增长后单次查询无限膨胀；管理页目前是整表拉取后前端筛选分页。
  // 只取列表真正渲染的列：description 是富文本，单行接近 2KB，占了整个响应的四成多，
  // 而列表页一个字都不显示。编辑器打开时会用上面的 ?id= 分支单独取完整产品。
  const { data: products, error, count } = await supabase
    .from('products')
    .select('id, name, slug, collection, images, attribute_config, is_active', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(PRODUCTS_CAP)
  if (error) return errorResponse(error, { tag: 'admin-products-get' })

  const { data: skus } = await supabase
    .from('product_skus')
    .select('id, product_id, colour, colour_hex, attributes, stock_qty, price_gbp')
    .order('product_id')
    .limit(SKUS_CAP)

  return NextResponse.json({
    products: products || [],
    skus:     skus || [],
    total:    count ?? (products || []).length,
    limit:    PRODUCTS_CAP,
  })
}

// 新建/更新/删除产品
export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { action, product, skus, deletedSkuIds } = body

    if (action === 'create') {
      const { data, error } = await supabase
        .from('products')
        .insert({
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
        })
        .select('id')
        .single()

      if (error) return errorResponse(error, { tag: 'admin-products-create' })

      const productId = data.id

      if (skus && skus.length > 0) {
        for (const sku of skus) {
          const skuData = {
            product_id: productId,
            sku_code: `${product.slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            colour: sku.colour || sku.attributes?.['颜色'] || sku.attributes?.['Colour'] || sku.attributes?.['Color'] || '默认',
            colour_hex: sku.colour_hex || '#D4C5B0',
            width_mm: sku.width_mm ? parseInt(sku.width_mm) : null,
            length_m: sku.length_m ? parseInt(sku.length_m) : null,
            price_gbp: parseFloat(sku.price_gbp) || 0,
            stock_qty: parseInt(sku.stock_qty) || 0,
            is_active: sku.is_active !== false,
            attributes: sku.attributes || {},
          }
          await supabase.from('product_skus').insert(skuData)
        }
      }

      return NextResponse.json({ id: productId })

    } else if (action === 'update') {
      const { error } = await supabase
        .from('products')
        .update({
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
        })
        .eq('id', product.id)

      if (error) return errorResponse(error, { tag: 'admin-products-update' })

      // 删除前端标记要删除的SKU
      if (deletedSkuIds && deletedSkuIds.length > 0) {
        await supabase.from('product_skus').delete().in('id', deletedSkuIds)
      }

      // 额外保障：把数据库里不在当前skus列表中的也删掉
      if (skus && skus.length > 0) {
        const keepIds = skus.filter(s => s.id).map(s => s.id)
        if (keepIds.length > 0) {
          await supabase.from('product_skus').delete()
            .eq('product_id', product.id)
            .not('id', 'in', `(${keepIds.join(',')})`)
        } else {
          // 没有保留任何已有SKU，全部删掉
          await supabase.from('product_skus').delete().eq('product_id', product.id)
        }
      }

      if (skus && skus.length > 0) {
        for (const sku of skus) {
          const skuData = {
            product_id: product.id,
            colour: sku.colour || sku.attributes?.['颜色'] || sku.attributes?.['Colour'] || sku.attributes?.['Color'] || '默认',
            colour_hex: sku.colour_hex || '#D4C5B0',
            width_mm: sku.width_mm ? parseInt(sku.width_mm) : null,
            length_m: sku.length_m ? parseInt(sku.length_m) : null,
            price_gbp: parseFloat(sku.price_gbp) || 0,
            stock_qty: parseInt(sku.stock_qty) || 0,
            is_active: sku.is_active !== false,
            attributes: sku.attributes || {},
            images: sku.images || [],
          }

          if (sku.id) {
            await supabase.from('product_skus').update(skuData).eq('id', sku.id)
          } else {
            skuData.sku_code = `${product.slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
            await supabase.from('product_skus').insert(skuData)
          }
        }
      }

      return NextResponse.json({ ok: true })

    } else if (action === 'delete') {
      // 检查是否有历史订单引用此产品
      const { count: orderItemCount } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', product.id)

      if (orderItemCount && orderItemCount > 0) {
        // 有订单记录：不物理删除，改为下架 + 停用所有 SKU，保留历史订单数据完整性
        await supabase.from('product_skus').update({ is_active: false }).eq('product_id', product.id)
        await supabase.from('products').update({ is_active: false }).eq('id', product.id)
        return NextResponse.json({
          ok: true,
          softDeleted: true,
          message: `该产品有 ${orderItemCount} 条历史订单记录，已改为下架而非删除，以保留订单历史数据完整性。`,
        })
      }

      await supabase.from('product_skus').delete().eq('product_id', product.id)
      await supabase.from('products').delete().eq('id', product.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-products-post' })
  }
}
