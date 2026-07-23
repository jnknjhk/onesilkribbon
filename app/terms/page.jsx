export const metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions for purchasing from One Silk Ribbon.',
  alternates: { canonical: '/terms' },
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
          <p>Orders are shipped from our workshop in China and are usually dispatched within 2 business days of payment being received. Orders are shipped by air and typically arrive within 5–14 days of dispatch. Delivery timescales are estimates and not guaranteed — we are not liable for delays caused by customs clearance, local postal services, or circumstances beyond our control.</p>
          <p>Risk of loss and title for items pass to you upon delivery.</p>

          <h2>5. Returns &amp; Refunds</h2>
          <p>We accept returns for eligible products. Cut-to-length, custom-made, and personalised items cannot be returned, as they are prepared specifically to your requirements. Please contact us before returning any item — items returned without prior approval may not be accepted.</p>
          <p>To initiate a return, email <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a> with your order number. Return postage is at your expense unless the item is faulty or the return is due to an error on our part.</p>
          <p>Refunds will be processed once the returned item has been received and inspected. See our <a href="/shipping-returns">Shipping &amp; Returns</a> page for full details.</p>

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
