export const metadata = {
  title: 'Privacy Policy — One Silk Ribbon',
  description: 'How One Silk Ribbon collects, uses and protects your personal data.',
}

export default function PrivacyPolicy() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="policy-wrap">
          <h1>Privacy Policy</h1>
          <p className="updated">Last updated: March 2026</p>

          <p>One Silk Ribbon (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting your personal data. This policy explains what information we collect, how we use it, and your rights under UK GDPR and the Data Protection Act 2018.</p>

          <h2>1. Who We Are</h2>
          <p>One Silk Ribbon is an online retailer of handcrafted mulberry silk ribbons, operating at <a href="https://onesilkribbon.com">onesilkribbon.com</a>. For data enquiries, contact us at <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a>.</p>

          <h2>2. Data We Collect</h2>
          <p>When you place an order or create an account, we may collect:</p>
          <ul>
            <li>Name, email address, delivery address and phone number</li>
            <li>Payment information (processed securely by PayPal / Stripe — we never store card details)</li>
            <li>Order history and preferences</li>
            <li>IP address and browser information for fraud prevention</li>
          </ul>
          <p>If you sign up to our newsletter, we collect your email address only.</p>

          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To process and fulfil your orders</li>
            <li>To send order confirmations and shipping updates</li>
            <li>To respond to customer service enquiries</li>
            <li>To send marketing emails (only with your consent — you may unsubscribe at any time)</li>
            <li>To improve our website and services</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2>4. Legal Basis for Processing</h2>
          <p>We process your data on the following legal bases: <strong>contract performance</strong> (to fulfil your order), <strong>legitimate interests</strong> (fraud prevention, site improvement), and <strong>consent</strong> (marketing emails).</p>

          <h2>5. Sharing Your Data</h2>
          <p>We share your data only where necessary:</p>
          <ul>
            <li><strong>Payment processors</strong> — PayPal, Stripe (PCI-DSS compliant)</li>
            <li><strong>Delivery couriers</strong> — Royal Mail and other carriers, for delivery purposes only</li>
            <li><strong>Email service provider</strong> — for transactional and marketing emails</li>
            <li><strong>Legal authorities</strong> — if required by law</li>
          </ul>
          <p>We never sell your personal data to third parties.</p>

          <h2>6. Data Retention</h2>
          <p>We retain order data for 7 years for tax and legal compliance. Newsletter subscriptions are held until you unsubscribe. You may request deletion of your account at any time.</p>

          <h2>7. Your Rights</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion (&ldquo;right to be forgotten&rdquo;)</li>
            <li>Object to or restrict processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>To exercise any of these rights, email <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a>. You also have the right to lodge a complaint with the <a href="https://ico.org.uk" target="_blank" rel="noopener">ICO (Information Commissioner&rsquo;s Office)</a>.</p>

          <h2>8. Cookies</h2>
          <p>We use cookies to keep your basket, remember preferences, and analyse site usage. See our <a href="/cookies">Cookie Policy</a> for full details.</p>

          <h2>9. Changes to This Policy</h2>
          <p>We may update this policy from time to time. The &ldquo;last updated&rdquo; date at the top of this page will reflect any changes. Continued use of our site after changes constitutes acceptance.</p>
        </div>
      </div>

      <style>{`
        .policy-wrap {
          max-width: 780px;
          margin: 0 auto;
          padding: 80px 60px 120px;
        }
        .policy-wrap h1 {
          font-family: var(--font-display);
          font-size: 38px;
          font-weight: 300;
          color: var(--ink);
          margin-bottom: 10px;
          line-height: 1.15;
        }
        .policy-wrap .updated {
          font-size: 10px;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--taupe);
          margin-bottom: 56px;
          padding-bottom: 32px;
          border-bottom: 1px solid var(--sand);
        }
        .policy-wrap h2 {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 300;
          color: var(--ink);
          margin: 48px 0 16px;
        }
        .policy-wrap p, .policy-wrap li {
          font-size: 13px;
          line-height: 2.1;
          color: var(--taupe);
          margin-bottom: 12px;
        }
        .policy-wrap ul {
          padding-left: 20px;
          margin-bottom: 12px;
        }
        .policy-wrap a { color: var(--gold); text-decoration: none; }
        .policy-wrap a:hover { text-decoration: underline; }
        @media(max-width: 768px) {
          .policy-wrap { padding: 48px 24px 80px; }
          .policy-wrap h1 { font-size: 28px; }
        }
      `}</style>
    </>
  )
}
