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

// 新建/更新/删除产品
export async function POST(req) {
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
          is_featured: false,
          images: product.images || [],
          attribute_config: product.attribute_config || [],
          specifications: product.specifications || [],
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
          images: product.images || [],
          attribute_config: product.attribute_config || [],
          specifications: product.specifications || [],
        })
        .eq('id', product.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
