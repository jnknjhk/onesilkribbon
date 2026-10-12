import { escapeHtml } from '@osr/core/lib/escape-html'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'One Glass Object <hello@oneglassobject.com>'

// 和联系页输入框的 maxLength 保持一致
const MAX_LEN = { name: 100, email: 254, subject: 200, message: 5000 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 自动回复会发到表单里填的任意邮箱，所以邮件里不能出现对方能控制的内容——
// 否则别人可以借本站的发件地址，给任何人发一封写着他想写的话的邮件。
// 称呼只保留名字第一个词里的字母，没有就不带称呼。
function greetingName(name) {
  const first = String(name).trim().split(/\s+/)[0] || ''
  return first.replace(/[^\p{L}\p{M}'’-]/gu, '').slice(0, 30)
}

// 邮件标题是纯文本，去掉换行等控制字符
const oneLine = (s) => String(s).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim()

// 注意：丝带站这个接口还按 email_log 表做了发信频率上限，本站还没有 email_log 表，
// 建库时如果把邮件记录也搬过来，记得把频率上限一起加上。
export async function POST(req) {
  try {
    const body = await req.json()
    const name    = String(body.name    ?? '').trim()
    const email   = String(body.email   ?? '').trim().toLowerCase()
    const subject = String(body.subject ?? '').trim()
    const message = String(body.message ?? '').trim()

    // 蜜罐：页面上藏起来的 website 字段，真人看不到也不会填，自动脚本会把所有输入框都填上。
    // 假装发送成功，不给脚本任何反馈。
    if (body.website) return Response.json({ success: true })

    if (!name || !email || !message) {
      return Response.json({ error: 'Please fill in all required fields' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }
    if (name.length > MAX_LEN.name || email.length > MAX_LEN.email ||
        subject.length > MAX_LEN.subject || message.length > MAX_LEN.message) {
      return Response.json({ error: 'Your message is too long — please shorten it and try again' }, { status: 400 })
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
        <p class="label">From</p><p class="value">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p class="label">Subject</p><p class="value">${escapeHtml(subject || 'Website Enquiry')}</p>
        <p class="label">Message</p>
        <div class="message">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
      </div>
      <div class="footer">Sent via oneglassobject.com contact form</div>
    </div></body></html>`

    // Auto-reply to customer — 除了过滤过的称呼，不含任何用户填写的内容（见 greetingName）
    const greet = greetingName(name)
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
      <div class="header"><h1>One Glass Object</h1><p>Handcrafted Mulberry Silk</p></div>
      <div class="body">
        <p style="font-family:'Georgia',serif;font-size:28px;font-style:italic;color:#1C1714;font-weight:300;margin-bottom:16px">Thank you${greet ? `, ${escapeHtml(greet)}` : ''}</p>
        <p class="text">We have received your message and will get back to you within 2 working days.</p>
        <p class="text" style="font-size:13px;color:#9A8878">If your enquiry is urgent, please email us directly at<br><a href="mailto:hello@oneglassobject.com" style="color:#B89B6A">hello@oneglassobject.com</a></p>
      </div>
      <div class="footer">
        <p><a href="https://oneglassobject.com">oneglassobject.com</a> · <a href="mailto:hello@oneglassobject.com">hello@oneglassobject.com</a></p>
        <p style="margin-top:8px">© ${new Date().getFullYear()} One Glass Object. All rights reserved.</p>
      </div>
    </div></body></html>`

    await Promise.all([
      fetch(RESEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM, to: 'hello@oneglassobject.com', reply_to: email, subject: oneLine(`New Enquiry: ${subject || 'Website Contact'} — ${name}`), html: ownerHtml }),
      }),
      fetch(RESEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM, to: email, subject: 'We received your message — One Glass Object', html: replyHtml }),
      }),
    ])

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return Response.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
