const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'One Silk Ribbon <song@onesilkribbon.com>'

export async function POST(req) {
  try {
    const { name, email, subject, message } = await req.json()
    if (!name || !email || !message) {
      return Response.json({ error: 'Please fill in all required fields' }, { status: 400 })
    }

    // Email to owner
    const ownerHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:0;background:#F7F3EE;font-family:'Georgia',serif}
      .wrapper{max-width:600px;margin:0 auto;background:#fff}
      .header{background:#1C1714;padding:32px 40px;text-align:center}
      .header h1{color:#F7F3EE;font-size:20px;font-weight:300;letter-spacing:.3em;margin:0;text-transform:uppercase}
      .body{padding:40px}
      .label{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9A8878;margin-bottom:4px}
      .value{font-size:14px;color:#1C1714;margin-bottom:20px;line-height:1.7}
      .message{background:#F7F3EE;padding:20px;font-size:14px;color:#4a4039;line-height:1.9;white-space:pre-wrap}
      .footer{background:#F7F3EE;padding:20px 40px;text-align:center;font-size:11px;color:#9A8878}
    </style></head>
    <body><div class="wrapper">
      <div class="header"><h1>New Enquiry</h1></div>
      <div class="body">
        <p class="label">From</p><p class="value">${name} &lt;${email}&gt;</p>
        <p class="label">Subject</p><p class="value">${subject || 'Website Enquiry'}</p>
        <p class="label">Message</p>
        <div class="message">${message.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="footer">Sent via onesilkribbon.com contact form</div>
    </div></body></html>`

    // Auto-reply to customer
    const replyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:0;background:#F7F3EE;font-family:'Georgia',serif}
      .wrapper{max-width:600px;margin:0 auto;background:#fff}
      .header{background:#1C1714;padding:32px 40px;text-align:center}
      .header h1{color:#F7F3EE;font-size:22px;font-weight:300;letter-spacing:.3em;margin:0;text-transform:uppercase}
      .header p{color:#B89B6A;font-size:11px;letter-spacing:.2em;margin:8px 0 0;text-transform:uppercase}
      .body{padding:48px 40px;text-align:center}
      .text{font-size:14px;color:#4a4039;line-height:1.9;margin-bottom:24px}
      .footer{background:#F7F3EE;padding:24px 40px;text-align:center}
      .footer p{font-size:11px;color:#9A8878;line-height:1.8;margin:0}
      .footer a{color:#B89B6A;text-decoration:none}
    </style></head>
    <body><div class="wrapper">
      <div class="header"><h1>One Silk Ribbon</h1><p>Handcrafted Mulberry Silk</p></div>
      <div class="body">
        <p style="font-family:'Georgia',serif;font-size:28px;font-style:italic;color:#1C1714;font-weight:300;margin-bottom:16px">Thank you, ${name}</p>
        <p class="text">We have received your message and will get back to you within 2 working days.</p>
        <p class="text" style="font-size:13px;color:#9A8878">If your enquiry is urgent, please email us directly at<br><a href="mailto:song@onesilkribbon.com" style="color:#B89B6A">song@onesilkribbon.com</a></p>
      </div>
      <div class="footer">
        <p><a href="https://onesilkribbon.com">onesilkribbon.com</a> · <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
        <p style="margin-top:8px">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
      </div>
    </div></body></html>`

    await Promise.all([
      fetch(RESEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM, to: 'song@onesilkribbon.com', reply_to: email, subject: `New Enquiry: ${subject || 'Website Contact'} — ${name}`, html: ownerHtml }),
      }),
      fetch(RESEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM, to: email, subject: 'We received your message — One Silk Ribbon', html: replyHtml }),
      }),
    ])

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return Response.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
