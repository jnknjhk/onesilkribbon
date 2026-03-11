import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// 获取所有产品
export async function GET() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 新建或更新产品
export async function POST(req) {
  try {
    const body = await req.json()
    const { action, product, skus, deletedSkuIds } = body

    if (action === 'create') {
      // 新建产品
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          slug: product.slug,
          description: product.description,
          collection: product.collection,
          is_active: product.is_active,
          is_featured: false,
          images: product.images || [],
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const productId = data.id

      // 保存 SKU
      if (skus && skus.length > 0) {
        for (const sku of skus) {
          const skuData = {
            product_id: productId,
            sku_code: `${product.slug}-${(sku.colour || 'default').toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`,
            colour: sku.colour || '默认',
            colour_hex: sku.colour_hex || '#D4C5B0',
            width_mm: sku.width_mm ? parseInt(sku.width_mm) : null,
            length_m: sku.length_m ? parseInt(sku.length_m) : 10,
            price_gbp: parseFloat(sku.price_gbp) || 0,
            stock_qty: parseInt(sku.stock_qty) || 0,
            is_active: sku.is_active !== false,
          }
          await supabase.from('product_skus').insert(skuData)
        }
      }

      return NextResponse.json({ id: productId })

    } else if (action === 'update') {
      // 更新产品
      const { error } = await supabase
        .from('products')
        .update({
          name: product.name,
          slug: product.slug,
          description: product.description,
          collection: product.collection,
          is_active: product.is_active,
          images: product.images || [],
        })
        .eq('id', product.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // 删除被移除的 SKU
      if (deletedSkuIds && deletedSkuIds.length > 0) {
        for (const skuId of deletedSkuIds) {
          await supabase.from('product_skus').delete().eq('id', skuId)
        }
      }

      // 保存 SKU
      if (skus && skus.length > 0) {
        for (const sku of skus) {
          const skuData = {
            product_id: product.id,
            colour: sku.colour || '默认',
            colour_hex: sku.colour_hex || '#D4C5B0',
            width_mm: sku.width_mm ? parseInt(sku.width_mm) : null,
            length_m: sku.length_m ? parseInt(sku.length_m) : 10,
            price_gbp: parseFloat(sku.price_gbp) || 0,
            stock_qty: parseInt(sku.stock_qty) || 0,
            is_active: sku.is_active !== false,
          }

          if (sku.id) {
            // 更新已有 SKU
            await supabase.from('product_skus').update(skuData).eq('id', sku.id)
          } else {
            // 新建 SKU
            skuData.sku_code = `${product.slug}-${(sku.colour || 'default').toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`
            await supabase.from('product_skus').insert(skuData)
          }
        }
      }

      return NextResponse.json({ ok: true })

    } else if (action === 'delete') {
      // 删除产品及其 SKU
      await supabase.from('product_skus').delete().eq('product_id', product.id)
      await supabase.from('products').delete().eq('id', product.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Admin product API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
