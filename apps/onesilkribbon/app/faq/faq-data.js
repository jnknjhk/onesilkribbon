// FAQ 问答数据。抽出来是为了让服务端也能读到——
// 页面要用它渲染，同时 page.jsx 要用它生成 FAQPage 结构化数据。
// 放在客户端组件里的话服务端拿不到，就只能把同一批问答写两遍，迟早写岔。
//
// 运费相关的答案依赖后台 settings，所以做成函数而不是常量。
export function getFaqs({ shippingRate = '3.95', freeThreshold = '45', freeEnabled = true } = {}) {
return [
  {
    category: 'Orders & Delivery',
    items: [
      { q: 'How long will my order take to arrive?', a: 'We dispatch orders within 2 business days of payment being received. Orders are shipped by air from our workshop and typically arrive within 5–14 days of dispatch, depending on your destination and local customs clearance.' },
      { q: 'Do you offer free shipping?', a: freeEnabled ? `Yes — shipping is free on all orders over £${freeThreshold}. Below that, it is £${shippingRate} per order.` : `Shipping is £${shippingRate} per order.` },
      { q: 'Can I track my order?', a: 'Yes. Once your order is dispatched you will receive a confirmation email with tracking information. Tracking may take a little time to become active after dispatch.' },
      { q: 'Do you ship internationally?', a: 'Yes, we ship worldwide to the United Kingdom, Europe, and beyond. Please note that international orders may be subject to customs duties, import taxes, or VAT, which are the responsibility of the customer unless otherwise stated at checkout.' },
    ],
  },
  {
    category: 'Products',
    items: [
      { q: 'What is Grade 6A mulberry silk?', a: 'Grade 6A is the highest classification of mulberry silk, denoting the longest, most consistent filaments with minimal breakage. It produces a smoother, more lustrous fabric with a superior drape — the grade used in luxury fashion and heirloom textiles.' },
      { q: 'What does "hand-torn" mean?', a: 'Our hand-frayed ribbons are torn along the grain of the silk rather than cut. This creates a naturally irregular, feathery edge that no machine can replicate — a texture unique to each yard.' },
      { q: 'Will the colour look exactly as shown on screen?', a: 'We photograph our ribbons carefully, but screen colours vary. Because the colour is applied by hand, there can also be subtle batch-to-batch variation — which we consider part of their character. If colour accuracy is critical (e.g. for a wedding), contact us and we can send a sample.' },
      // 原答案写的是"大多数按米卖"，与实际不符：手工毛边系列按 1 / 3 / 5 码（yard）
      // 整段出售，细丝带是 10 米整卷。客户照原答案下单会对不上。
      { q: 'What lengths do you sell?', a: 'Our hand-frayed ribbons are sold as continuous lengths of 1, 3 or 5 yards, with no joins mid-ribbon. The ultra-fine ribbons come on 10 metre spools. The exact length options are shown on each product page.' },
    ],
  },
  {
    category: 'Returns & Care',
    items: [
      { q: 'What is your returns policy?', a: 'We accept returns for eligible products — please contact us before sending anything back. Items must be unused, in their original condition and packaging, and suitable for resale. Cut-to-length, custom-made, and personalised products cannot be returned. See our Shipping & Returns page for full details.' },
      { q: 'How do I care for my silk ribbon?', a: 'Hand wash gently in cool water with a mild detergent. Lay flat to dry away from direct sunlight. Iron on a low silk setting with a pressing cloth. Store rolled or flat, away from moisture and heat. See our full Care Guide for more.' },
      { q: 'My ribbon arrived damaged — what do I do?', a: 'We are sorry to hear that. Please email song@onesilkribbon.com within 7 days of receipt with your order number and a photo of the damage. We will arrange a replacement or full refund at no cost to you.' },
    ],
  },
  {
    category: 'Bespoke & Wholesale',
    items: [
      { q: 'Can I order a custom colour?', a: 'Yes. We welcome bespoke commissions for specific colourways, widths, and lengths. Minimum order is typically 10 metres per colourway. Visit our Bespoke page or email song@onesilkribbon.com to start a conversation.' },
      { q: 'Do you offer trade or wholesale pricing?', a: 'Yes, we work with florists, stylists, boutiques, and brands. Email song@onesilkribbon.com with details about your business and requirements and we will send you our wholesale information.' },
    ],
  },
]
}
