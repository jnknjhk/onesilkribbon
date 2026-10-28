import { supabaseAdmin as supabaseServer } from '@osr/core/lib/supabase'
import { shippingSettingsFromApi, shippingDescription } from '@/lib/pricing'
import { STANDARD_RETURN_DAYS } from '@/lib/merchant-return-policy'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata = {
  title: 'Shipping & Returns',
  description: 'Delivery options, timescales and returns policy for One Silk Ribbon.',
  alternates: { canonical: '/shipping-returns' },
}

export default async function ShippingReturns() {
  const { data: settings, error } = await supabaseServer
    .from('settings')
    .select('key, value')
    .in('key', ['shipping_rate', 'free_shipping_threshold', 'free_shipping_enabled'])
  if (error) throw new Error('Unable to load delivery charges. Please try again.')

  const map = Object.fromEntries((settings || []).map(r => [r.key, r.value]))
  const shippingDesc = shippingDescription(shippingSettingsFromApi(map))

  return (
    <>
      <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="policy-wrap">
          <h1>Shipping &amp; Returns</h1>
          <p className="updated">Last updated: 28 October 2026</p>

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
          <p>We accept returns of standard products, including ribbons sold in our fixed catalogue colours, widths and lengths. Please contact us before sending an item back so that we can provide the correct return instructions. This process does not restrict your statutory cancellation rights.</p>

          <h2>Standard Returns</h2>
          <p>You may notify us that you wish to cancel or return a standard product within {STANDARD_RETURN_DAYS} calendar days after delivery, without giving a reason. You then have a further {STANDARD_RETURN_DAYS} days after notifying us to send the goods back. The customer arranges and pays the return postage for change-of-mind returns.</p>
          <p>Please keep items:</p>
          <ul>
            <li>Unused beyond the handling necessary to inspect them</li>
            <li>In their original condition</li>
            <li>In their original packaging where possible</li>
          </ul>
          <p>Reasonable inspection does not remove your statutory cancellation rights. We may reduce a refund for loss in value caused by handling beyond what is necessary to inspect the goods, where the law permits. To request a return, email <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a> with your order number and the items you wish to return.</p>

          <h2>Damaged or Defective Items</h2>
          <p>If your order arrives damaged or you believe the product has a quality issue, please contact us promptly at <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a>. Faulty, damaged or incorrectly supplied items are handled separately from change-of-mind returns. The {STANDARD_RETURN_DAYS}-day change-of-mind period and the bespoke-product exclusions below do not limit your statutory rights concerning these problems.</p>
          <p>Please include:</p>
          <ul>
            <li>Your order number</li>
            <li>A description of the issue</li>
            <li>Clear photographs or videos showing the problem</li>
          </ul>
          <p>If the issue is confirmed to be a product quality problem or damage that occurred before delivery, we will provide an appropriate solution. Where a return is required due to a confirmed product quality issue, we will cover the return shipping cost.</p>

          <h2>Custom and Personalised Orders</h2>
          <p>The change-of-mind cancellation right may not apply to goods made to your individual specifications or clearly personalised for you, including:</p>
          <ul>
            <li>Ribbon cut to a bespoke length specifically requested outside our standard catalogue options</li>
            <li>Products made or altered to your individual specifications</li>
            <li>Clearly personalised products</li>
          </ul>
          <p>Choosing from our standard catalogue colours, widths or lengths does not by itself make a product bespoke. Those standard products follow the {STANDARD_RETURN_DAYS}-day return policy above. Any applicable bespoke exclusion will be explained before the custom order is placed and does not remove your statutory rights if the goods are faulty or not as described.</p>

          <h2>Exchanges</h2>
          <p>We currently do not offer direct exchanges. If you would like a different product, colour, size, or variation, please contact us regarding the available options.</p>

          <h2>Refunds</h2>
          <p>Refunds for statutory cancellations will be issued within {STANDARD_RETURN_DAYS} days after we receive the returned goods or evidence that you sent them back, whichever is earlier. Refunds are made to the original payment method unless otherwise agreed.</p>
          <p>When you cancel a whole standard order under your statutory cancellation rights, we also refund the standard outbound delivery charge. The extra cost of an upgraded delivery service is not refundable. We cover return postage where the return is required because of a confirmed product quality problem, damage before delivery or an error on our part.</p>

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
