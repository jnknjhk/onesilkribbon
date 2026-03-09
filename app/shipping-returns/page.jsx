export const metadata = {
  title: 'Shipping & Returns — One Silk Ribbon',
  description: 'Delivery options, timescales and returns policy for One Silk Ribbon.',
}

export default function ShippingReturns() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="policy-wrap">
          <h1>Shipping &amp; Returns</h1>
          <p className="updated">Last updated: March 2026</p>

          <p>Every order from One Silk Ribbon is carefully prepared by hand — wrapped in tissue, rolled onto a vintage wooden spool, and sealed with our wax stamp. Here is everything you need to know about how it reaches you.</p>

          <h2>UK Delivery</h2>
          <ul>
            <li><strong>Standard (Royal Mail 2nd Class)</strong> — 3–5 working days · Free on orders over £45, otherwise £3.50</li>
            <li><strong>Express (Royal Mail 1st Class / Tracked)</strong> — 1–2 working days · £5.95</li>
          </ul>
          <p>Orders are dispatched within 2–3 working days of purchase, Monday to Friday. You will receive a dispatch confirmation email with tracking information where available.</p>

          <h2>International Delivery</h2>
          <ul>
            <li><strong>Europe</strong> — 7–10 working days · £8.95</li>
            <li><strong>Rest of World</strong> — 10–14 working days · £12.95</li>
          </ul>
          <p>International customers may be subject to import duties and taxes upon arrival. These charges are the responsibility of the recipient and are not included in our shipping fees.</p>

          <h2>Returns</h2>
          <p>We hope you love your ribbon. If for any reason you are not completely satisfied, we accept returns within <strong>14 days</strong> of the date you receive your order.</p>
          <p>To be eligible for a return:</p>
          <ul>
            <li>Items must be unused and in their original condition</li>
            <li>Items must be returned in their original packaging</li>
            <li>Bespoke or custom-cut orders are non-refundable unless faulty</li>
          </ul>
          <p>To initiate a return, please email <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a> with your order number and reason for return. We will respond within 2 working days with return instructions.</p>
          <p>Return postage costs are at your expense unless the item is faulty or incorrectly sent. We recommend using a tracked service as we cannot be responsible for items lost in return transit.</p>

          <h2>Refunds</h2>
          <p>Once your return is received and inspected, we will process your refund within <strong>5–7 working days</strong>. Refunds are issued to the original payment method. Please note that original shipping costs are non-refundable.</p>

          <h2>Faulty or Incorrect Items</h2>
          <p>If you receive a faulty or incorrect item, please contact us at <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a> within 7 days of receipt. We will arrange a free return and send a replacement or issue a full refund, including postage.</p>

          <h2>Questions?</h2>
          <p>Email us at <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a> and we will be happy to help.</p>
        </div>
      </div>

      <style>{`
        .policy-wrap { max-width: 780px; margin: 0 auto; padding: 80px 60px 120px; }
        .policy-wrap h1 { font-family: var(--font-display); font-size: 38px; font-weight: 300; color: var(--ink); margin-bottom: 10px; line-height: 1.15; }
        .policy-wrap .updated { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--taupe); margin-bottom: 56px; padding-bottom: 32px; border-bottom: 1px solid var(--sand); }
        .policy-wrap h2 { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: var(--ink); margin: 48px 0 16px; }
        .policy-wrap p, .policy-wrap li { font-size: 13px; line-height: 2.1; color: var(--taupe); margin-bottom: 12px; }
        .policy-wrap ul { padding-left: 20px; margin-bottom: 12px; }
        .policy-wrap a { color: var(--gold); text-decoration: none; }
        .policy-wrap a:hover { text-decoration: underline; }
        @media(max-width: 768px) { .policy-wrap { padding: 48px 24px 80px; } .policy-wrap h1 { font-size: 28px; } }
      `}</style>
    </>
  )
}
