export const metadata = {
  title: 'Cookie Policy — One Silk Ribbon',
  description: 'How One Silk Ribbon uses cookies on its website.',
}

export default function CookiePolicy() {
  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="policy-wrap">
          <h1>Cookie Policy</h1>
          <p className="updated">Last updated: March 2026</p>

          <p>This policy explains how One Silk Ribbon uses cookies and similar technologies when you visit <a href="https://onesilkribbon.com">onesilkribbon.com</a>.</p>

          <h2>What Are Cookies?</h2>
          <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and understand how you use it.</p>

          <h2>Cookies We Use</h2>

          <h2>Essential Cookies</h2>
          <p>These are required for the website to function and cannot be switched off.</p>
          <ul>
            <li><strong>Basket / Cart</strong> — remembers the items you have added to your basket</li>
            <li><strong>Session</strong> — maintains your session while you browse</li>
            <li><strong>Cookie consent</strong> — records your cookie preferences</li>
          </ul>

          <h2>Analytics Cookies</h2>
          <p>These help us understand how visitors interact with our site so we can improve it. We only set these with your consent.</p>
          <ul>
            <li><strong>Vercel Analytics</strong> — anonymous page view and performance data</li>
          </ul>

          <h2>Payment Cookies</h2>
          <p>Set by our payment providers when you proceed to checkout. These are strictly necessary to process your payment securely.</p>
          <ul>
            <li><strong>PayPal</strong> — fraud prevention and session management</li>
            <li><strong>Stripe</strong> — fraud prevention and payment processing</li>
          </ul>

          <h2>Managing Cookies</h2>
          <p>You can manage your cookie preferences at any time using the cookie banner shown on your first visit. You can also delete cookies via your browser settings — please note that disabling essential cookies may affect how the site works.</p>

          <h2>Changes to This Policy</h2>
          <p>We may update this policy from time to time. Please check back periodically for the latest version.</p>

          <h2>Contact</h2>
          <p>If you have any questions about our use of cookies, email us at <a href="mailto:hello@onesilkribbon.com">hello@onesilkribbon.com</a>.</p>
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
