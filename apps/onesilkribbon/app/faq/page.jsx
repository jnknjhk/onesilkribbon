import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import FAQContent from './FAQContent'
import { getFaqs } from './faq-data'

export const revalidate = 3600

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

  // FAQPage 结构化数据。这一页有 13 组真实问答，却一直没有标记——
  // 带 FAQPage 的结果在 Google 里可以直接展开问答，在搜索页上占的面积比普通蓝链大得多。
  // 答案取自渲染用的同一份数据，页面上显示什么、标记里就是什么（折叠在手风琴里是允许的，
  // 但两边内容不一致会被判定为误导性标记）。
  const faqs = getFaqs({ shippingRate, freeThreshold, freeEnabled })
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.flatMap(g => g.items).map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FAQContent shippingRate={shippingRate} freeThreshold={freeThreshold} freeEnabled={freeEnabled} />
    </>
  )
}
