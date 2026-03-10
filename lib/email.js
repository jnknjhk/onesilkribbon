// ─── Email sender via Resend ──────────────────────────────────────────────────
const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'One Silk Ribbon <song@onesilkribbon.com>'
const OWNER      = 'jnknjhk@gmail.com'

async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Email send failed')
  return data
}

// ─── Brand styles ─────────────────────────────────────────────────────────────
const styles = `
  body { margin:0; padding:0; background:#F7F3EE; font-family:'Georgia',serif; }
  .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#1C1714; padding:32px 40px; text-align:center; }
  .header h1 { color:#F7F3EE; font-size:22px; font-weight:300; letter-spacing:0.3em; margin:0; text-transform:uppercase; }
  .header p { color:#B89B6A; font-size:11px; letter-spacing:0.2em; margin:8px 0 0; text-transform:uppercase; }
  .body { padding:40px; }
  .greeting { font-size:24px; color:#1C1714; font-weight:300; font-style:italic; margin-bottom:16px; }
  .text { font-size:14px; color:#4a4039; line-height:1.8; margin-bottom:24px; }
  .order-box { background:#F7F3EE; border:1px solid #E8DDD0; padding:24px; margin-bottom:32px; }
  .order-box h3 { font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#9A8878; margin:0 0 16px; }
  .order-number { font-size:20px; color:#1C1714; font-weight:300; margin:0 0 4px; }
  .item-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #E8DDD0; font-size:13px; color:#4a4039; }
  .item-row:last-child { border-bottom:none; }
  .item-name { font-weight:400; }
  .item-price { color:#1C1714; }
  .totals { margin-top:16px; }
  .total-row { display:flex; justify-content:space-between; font-size:13px; color:#9A8878; padding:4px 0; }
  .total-row.grand { font-size:16px; color:#1C1714; border-top:1px solid #E8DDD0; padding-top:12px; margin-top:8px; }
  .address-box { background:#F7F3EE; border:1px solid #E8DDD0; padding:24px; margin-bottom:32px; }
  .address-box h3 { font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#9A8878; margin:0 0 12px; }
  .address-box p { font-size:13px; color:#4a4039; line-height:1.8; margin:0; }
  .btn { display:inline-block; background:#1C1714; color:#F7F3EE !important; text-decoration:none; padding:14px 32px; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; margin:8px 0 32px; }
  .divider { border:none; border-top:1px solid #E8DDD0; margin:32px 0; }
  .footer { background:#F7F3EE; padding:24px 40px; text-align:center; }
  .footer p { font-size:11px; color:#9A8878; line-height:1.8; margin:0; }
  .footer a { color:#B89B6A; text-decoration:none; }
  .gold { color:#B89B6A; }
`

const layout = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${styles}</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>One Silk Ribbon</h1>
    <p>Handcrafted Mulberry Silk</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>
      <a href="https://onesilkribbon.com">onesilkribbon.com</a> &nbsp;·&nbsp;
      <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a>
    </p>
    <p style="margin-top:8px;">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
    <p style="margin-top:8px;">
      <a href="https://onesilkribbon.com/privacy">Privacy Policy</a> &nbsp;·&nbsp;
      <a href="https://onesilkribbon.com/terms">Terms of Service</a>
    </p>
  </div>
</div>
</body>
</html>
`

// ─── 1. Order Confirmation ────────────────────────────────────────────────────
export async function sendOrderConfirmation({ order, items, form, totals }) {
  const itemsHtml = items.map(i => `
    <div class="item-row">
      <span class="item-name">${i.name} <span style="color:#9A8878;font-size:12px;">× ${i.qty}</span><br>
        <span style="font-size:11px;color:#9A8878;">${i.skuDesc || ''}</span>
      </span>
      <span class="item-price">£${(i.price * i.qty).toFixed(2)}</span>
    </div>
  `).join('')

  const html = layout(`
    <p class="greeting">Thank you for your order</p>
    <p class="text">
      Dear ${form.firstName},<br><br>
      We've received your order and it's being lovingly prepared. 
      You'll receive a shipping notification once your ribbons are on their way.
    </p>

    <div class="order-box">
      <h3>Order Details</h3>
      <p class="order-number">${order.order_number}</p>
      <p style="font-size:12px;color:#9A8878;margin:0 0 16px;">Placed on ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</p>
      ${itemsHtml}
      <div class="totals">
        <div class="total-row"><span>Subtotal (exc. VAT)</span><span>£${totals.subtotalExVat}</span></div>
        <div class="total-row"><span>VAT (20%)</span><span>£${totals.vatAmount}</span></div>
        <div class="total-row"><span>Shipping</span><span>${totals.freeShipping ? 'Free' : '£' + totals.shipping}</span></div>
        <div class="total-row grand"><span>Total</span><span>£${totals.total}</span></div>
      </div>
    </div>

    <div class="address-box">
      <h3>Delivering To</h3>
      <p>
        ${form.firstName} ${form.lastName}<br>
        ${form.line1}${form.line2 ? '<br>' + form.line2 : ''}<br>
        ${form.city}${form.postcode ? ', ' + form.postcode : ''}<br>
        ${form.country}
      </p>
    </div>

    <a href="https://onesilkribbon.com/track-order?order=${order.order_number}" class="btn">Track Your Order</a>

    <hr class="divider">
    <p class="text" style="font-size:13px;">
      Questions about your order? Reply to this email or contact us at 
      <a href="mailto:song@onesilkribbon.com" class="gold">song@onesilkribbon.com</a>
    </p>
  `)

  await sendEmail({
    to: form.email,
    subject: `Order Confirmed — ${order.order_number} | One Silk Ribbon`,
    html,
  })
}

// ─── Owner Notification ───────────────────────────────────────────────────────
export async function sendOwnerNotification({ order, items, form, totals }) {
  const itemsText = items.map(i => `${i.name} × ${i.qty} — £${(i.price * i.qty).toFixed(2)}`).join('<br>')

  const html = layout(`
    <p class="greeting">New Order Received 🎉</p>
    <div class="order-box">
      <h3>Order</h3>
      <p class="order-number">${order.order_number}</p>
      <p style="font-size:13px;color:#4a4039;margin:8px 0;">${itemsText}</p>
      <div class="totals">
        <div class="total-row grand"><span>Total</span><span>£${totals.total}</span></div>
      </div>
    </div>
    <div class="address-box">
      <h3>Customer</h3>
      <p>
        ${form.firstName} ${form.lastName}<br>
        <a href="mailto:${form.email}">${form.email}</a><br>
        ${form.dialCode || ''} ${form.phone || ''}<br><br>
        ${form.line1}${form.line2 ? ', ' + form.line2 : ''}, ${form.city}${form.postcode ? ', ' + form.postcode : ''}, ${form.country}
      </p>
    </div>
    <a href="https://onesilkribbon.com/admin/orders" class="btn">View in Admin</a>
  `)

  await sendEmail({
    to: OWNER,
    subject: `New Order £${totals.total} — ${order.order_number}`,
    html,
  })
}

// ─── 2. Shipping Notification ─────────────────────────────────────────────────
export async function sendShippingNotification({ order, trackingNumber, carrier, trackingUrl }) {
  const html = layout(`
    <p class="greeting">Your order is on its way</p>
    <p class="text">
      Dear ${order.shipping_name?.split(' ')[0] || 'Customer'},<br><br>
      Your One Silk Ribbon order has been carefully packaged and handed to our courier. 
      We hope you love your ribbons as much as we loved making them.
    </p>

    <div class="order-box">
      <h3>Tracking Information</h3>
      <p style="font-size:13px;color:#9A8878;margin:0 0 4px;">Order</p>
      <p class="order-number" style="font-size:16px;">${order.order_number}</p>
      <p style="font-size:13px;color:#9A8878;margin:16px 0 4px;">Carrier</p>
      <p style="font-size:14px;color:#1C1714;margin:0;">${carrier}</p>
      <p style="font-size:13px;color:#9A8878;margin:16px 0 4px;">Tracking Number</p>
      <p style="font-size:14px;color:#1C1714;margin:0;">${trackingNumber}</p>
    </div>

    ${trackingUrl ? `<a href="${trackingUrl}" class="btn">Track Your Parcel</a>` : ''}

    <hr class="divider">
    <p class="text" style="font-size:13px;">
      Estimated delivery is typically 2–5 working days. 
      If you have any questions, contact us at 
      <a href="mailto:song@onesilkribbon.com" class="gold">song@onesilkribbon.com</a>
    </p>
  `)

  await sendEmail({
    to: order.customer_email,
    subject: `Your order is on its way — ${order.order_number} | One Silk Ribbon`,
    html,
  })
}
