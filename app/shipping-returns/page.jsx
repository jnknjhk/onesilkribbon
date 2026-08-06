import { supabaseAdmin as supabaseServer } from '@/lib/supabase'

export const revalidate = 3600

export const metadata = {
  title: 'Shipping & Returns',
  description: 'Delivery options, timescales and returns policy for One Silk Ribbon.',
  alternates: { canonical: '/shipping-returns' },
}

export default async function ShippingReturns() {
  const { data: settings } = await supabaseServer
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])

  const map = Object.fromEntries((settings || []).map(r => [r.key, r.value]))
  const shippingRate      = parseFloat(map.shipping_rate || '3.95').toFixed(2)
  const freeThreshold     = parseFloat(map.free_shipping_threshold || '45').toFixed(0)
  const freeEnabled       = map.free_shipping_enabled !== 'false'

  const shippingDesc = freeEnabled
    ? `free on orders over £${freeThreshold}, otherwise £${shippingRate} per order`
    : `£${shippingRate} per order`

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="policy-wrap">
          <h1>Shipping &amp; Returns</h1>
          <p className="updated">Last updated: July 2026</p>

          <p>Every order from One Silk Ribbon is carefully prepared by hand — wrapped in tissue, rolled onto a vintage wooden spool, and sealed with our wax stamp. Here is everything you need to know about how it reaches you.</p>

          <h2>Shipping</h2>
          <p>We ship orders from our workshop in China to customers in the United Kingdom, Europe, and worldwide. Shipping is {shippingDesc}.</p>

          <h2>Order Processing</h2>
          <p>Orders are usually dispatched within 2 business days after payment has been successfully received.</p>
          <p>Once your order has been dispatched, you will receive a shipping confirmation email containing your tracking information.</p>

          <h2>Delivery Times</h2>
          <p>Orders are shipped by air and typically arrive within <strong>5–14 days</strong> after dispatch.</p>
          <p>Please note that delivery times are estimates and may vary depending on the destination country, customs clearance, local postal services, weather conditions, and other circumstances beyond our control.</p>

          <h2>Tracking</h2>
          <p>All orders are shipped with tracking information. You can use the tracking number provided in your shipping confirmation email to follow the progress of your shipment.</p>
          <p>Please note that tracking information may take some time to become active after your order has been dispatched.</p>

          <h2>Customs, Duties and Taxes</h2>
          <p>International orders may be subject to customs duties, import taxes, VAT, or other charges imposed by the destination country.</p>
          <p>Any customs duties, import taxes, VAT, or other fees charged by the destination country are the responsibility of the customer unless otherwise stated at checkout. We are not responsible for delays caused by customs clearance.</p>

          <h2>Returns</h2>
          <p>We accept returns for eligible products. If you wish to return an item, please contact us before sending anything back — items returned without prior approval may not be accepted.</p>

          <h2>Standard Returns</h2>
          <p>You may request a return for eligible products if you change your mind or no longer wish to keep the item. The return shipping cost is the responsibility of the customer.</p>
          <p>The returned item must be:</p>
          <ul>
            <li>Unused</li>
            <li>In its original condition</li>
            <li>In its original packaging where applicable</li>
            <li>Suitable for resale</li>
          </ul>
          <p>Please contact us at <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a> before returning your order so that we can provide the appropriate return instructions. Refunds will be issued after the returned item has been received and inspected.</p>

          <h2>Damaged or Defective Items</h2>
          <p>If your order arrives damaged or you believe the product has a quality issue, please contact us at <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a> within 7 days of receiving your order.</p>
          <p>Please include:</p>
          <ul>
            <li>Your order number</li>
            <li>A description of the issue</li>
            <li>Clear photographs or videos showing the problem</li>
          </ul>
          <p>If the issue is confirmed to be a product quality problem or damage that occurred before delivery, we will provide an appropriate solution. Where a return is required due to a confirmed product quality issue, we will cover the return shipping cost.</p>

          <h2>Non-Returnable Items</h2>
          <p>The following items cannot be returned:</p>
          <ul>
            <li>Cut-to-length ribbon</li>
            <li>Products that have been cut or altered according to the customer&apos;s requested length</li>
            <li>Custom-made products</li>
            <li>Personalised products</li>
            <li>Products that have been used, altered, damaged, or modified after delivery</li>
          </ul>
          <p>Because these products are prepared specifically according to the customer&apos;s requirements, they cannot be resold.</p>

          <h2>Exchanges</h2>
          <p>We currently do not offer direct exchanges. If you would like a different product, colour, size, or variation, please contact us regarding the available options.</p>

          <h2>Refunds</h2>
          <p>Once your return has been received and inspected, we will process the refund for eligible returned items. The refund will generally be issued to the original payment method.</p>
          <p>Original shipping charges, if any, may not be refundable unless the return is due to a confirmed product quality issue or an error on our part.</p>

          <h2>Contact Us</h2>
          <p>If you have any questions about shipping or returns, please contact us before placing a return request. Email: <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .policy-wrap { max-width: 780px; margin: 0 auto; padding: 80px 60px 120px; }
        .policy-wrap h1 { font-family: var(--font-display); font-size: 38px; font-weight: 300; color: var(--ink); margin-bottom: 10px; line-height: 1.15; }
        .policy-wrap .updated { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--taupe); margin-bottom: 56px; padding-bottom: 32px; border-bottom: 1px solid var(--sand); }
        .policy-wrap h2 { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: var(--ink); margin: 48px 0 16px; }
        .policy-wrap p, .policy-wrap li { font-size: 15px; font-weight: 400; line-height: 2.1; color: var(--taupe); margin-bottom: 12px; }
        .policy-wrap ul { padding-left: 20px; margin-bottom: 12px; }
        .policy-wrap a { color: var(--gold); text-decoration: none; }
        .policy-wrap a:hover { text-decoration: underline; }
        @media(max-width: 768px) { .policy-wrap { padding: 48px 24px 80px; } .policy-wrap h1 { font-size: 28px; } }
      ` }} />
    </>
  )
}
