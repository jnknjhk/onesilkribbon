import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyAdmin } from '@osr/core/lib/admin-auth'
import { errorResponse } from '@osr/core/lib/api-error'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'One Silk Ribbon <song@onesilkribbon.com>'

const styles = `
  body { margin:0; padding:0; background:#F7F3EE; font-family:'Georgia',serif; }
  .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#1C1714; padding:32px 40px; text-align:center; }
  .header h1 { color:#F7F3EE; font-size:22px; font-weight:300; letter-spacing:0.3em; margin:0; text-transform:uppercase; }
  .header p { color:#B89B6A; font-size:11px; letter-spacing:0.2em; margin:8px 0 0; text-transform:uppercase; }
  .body { padding:40px; }
  .text { font-size:14px; color:#4a4039; line-height:1.9; margin-bottom:24px; white-space:pre-line; }
  .divider { border:none; border-top:1px solid #E8DDD0; margin:32px 0; }
  .footer { background:#F7F3EE; padding:24px 40px; text-align:center; }
  .footer p { font-size:11px; color:#9A8878; line-height:1.8; margin:0; }
  .footer a { color:#B89B6A; text-decoration:none; }
`

function buildHtml(subject, body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${styles}</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>One Silk Ribbon</h1>
    <p>Handcrafted Mulberry Silk</p>
  </div>
  <div class="body">
    <p class="text">${body.replace(/\n/g, '<br>')}</p>
    <hr class="divider">
    <p style="font-size:12px;color:#9A8878;">
      Questions? Contact us at <a href="mailto:song@onesilkribbon.com" style="color:#B89B6A;">song@onesilkribbon.com</a>
    </p>
  </div>
  <div class="footer">
    <p>
      <a href="https://onesilkribbon.com">onesilkribbon.com</a> &nbsp;·&nbsp;
      <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a>
    </p>
    <p style="margin-top:8px;">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
  </div>
</div>
</body>
</html>`
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { to, subject, body } = await req.json()
    if (!to || !subject || !body) {
      return Response.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const html = buildHtml(subject, body)

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to, cc: 'song@onesilkribbon.com', subject, html }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Send failed')

    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-send-email' })
  }
}
