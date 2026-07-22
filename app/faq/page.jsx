import { createClient } from '@supabase/supabase-js'
import FAQContent from './FAQContent'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about UK orders, delivery, silk ribbon care and our handmade process.',
  alternates: { canonical: '/faq' },
}

export default async function FAQPage() {
  const { data: settings } = await supabaseServer
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])

  const map = Object.fromEntries((settings || []).map(r => [r.key, r.value]))
  const shippingRate  = parseFloat(map.shipping_rate || '3.95').toFixed(2)
  const freeThreshold = parseFloat(map.free_shipping_threshold || '45').toFixed(0)
  const freeEnabled   = map.free_shipping_enabled !== 'false'

  return <FAQContent shippingRate={shippingRate} freeThreshold={freeThreshold} freeEnabled={freeEnabled} />
}
