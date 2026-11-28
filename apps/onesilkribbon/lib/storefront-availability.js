import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { FABRIC_COLLECTION } from './fabric'

async function readAvailability() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, product_skus!inner(id)')
      .eq('collection', FABRIC_COLLECTION)
      .eq('is_active', true)
      .eq('product_skus.is_active', true)
      .gt('product_skus.price_gbp', 0)
      .limit(1)
    if (error) return { fabricAvailable: false }
    return { fabricAvailable: (data || []).length > 0 }
  } catch {
    return { fabricAvailable: false }
  }
}

// Cached so the global navigation does not issue a query on every request.
// A new active fabric product reaches the navigation within a minute; drafts
// (is_active=false) never do.
export const getStorefrontAvailability = unstable_cache(
  readAvailability,
  ['storefront-availability'],
  { revalidate: 60 }
)
