export const metadata = {
  title: 'Terms & Conditions — One Silk Ribbon',
  description: 'Terms and conditions for purchasing from One Silk Ribbon.',
}

export default function Terms() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="policy-wrap">
          <h1>Terms &amp; Conditions</h1>
          <p className="updated">Last updated: March 2026</p>

          <p>Please read these terms carefully before placing an order with One Silk Ribbon. By purchasing from us, you agree to these terms.</p>

          <h2>1. About Us</h2>
          <p>One Silk Ribbon is an online retailer of handcrafted silk ribbons operating at <a href="https://onesilkribbon.com">onesilkribbon.com</a>. For any queries, contact us at <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a>.</p>

          <h2>2. Ordering</h2>
          <p>All orders are subject to availability and acceptance. We reserve the right to refuse or cancel any order. Once you place an order, you will receive a confirmation email — this constitutes acceptance of your order.</p>
          <p>Prices are displayed in GBP (£) and include UK VAT at 20% where applicable. We reserve the right to update prices at any time without prior notice.</p>

          <h2>3. Payment</h2>
          <p>We accept payment via PayPal and major credit/debit cards via Stripe. All transactions are processed securely. We do not store any card details.</p>

          <h2>4. Delivery</h2>
          <p>We aim to dispatch all orders within 2–3 working days. Delivery timescales are estimates and not guaranteed. We are not liable for delays caused by couriers or circumstances beyond our control.</p>
          <p>Risk of loss and title for items pass to you upon delivery.</p>

          <h2>5. Returns &amp; Refunds</h2>
          <p>You have the right to cancel your order within 14 days of receipt under the Consumer Contracts Regulations 2013. Items must be returned in their original condition and packaging.</p>
          <p>To initiate a return, email <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a> with your order number. Return postage is at your expense unless the item is faulty.</p>
          <p>Refunds will be processed within 14 days of receiving the returned item. See our <a href="/shipping-returns">Shipping &amp; Returns</a> page for full details.</p>

          <h2>6. Product Descriptions</h2>
          <p>We make every effort to ensure product descriptions, colours and images are accurate. However, due to the handcrafted and naturally dyed nature of our products, slight variations in colour and texture are inherent and not considered defects.</p>

          <h2>7. Intellectual Property</h2>
          <p>All content on this website — including text, images, logos and design — is the property of One Silk Ribbon and protected by copyright. You may not reproduce or use any content without prior written permission.</p>

          <h2>8. Limitation of Liability</h2>
          <p>Our total liability to you shall not exceed the value of your order. We are not liable for indirect, consequential or special losses.</p>

          <h2>9. Governing Law</h2>
          <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

          <h2>10. Changes to These Terms</h2>
          <p>We may update these terms from time to time. The current version is always available on this page.</p>
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
