import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const RESEND_API  = 'https://api.resend.com/emails'
const FROM        = 'One Silk Ribbon <song@onesilkribbon.com>'
const COUPON_CODE = 'WELCOME10'

const styles = `
  body { margin:0; padding:0; background:#F7F3EE; font-family:'Georgia',serif; }
  .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#1C1714; padding:32px 40px; text-align:center; }
  .header h1 { color:#F7F3EE; font-size:22px; font-weight:300; letter-spacing:0.3em; margin:0; text-transform:uppercase; }
  .header p { color:#B89B6A; font-size:11px; letter-spacing:0.2em; margin:8px 0 0; text-transform:uppercase; }
  .body { padding:40px; text-align:center; }
  .greeting { font-size:28px; color:#1C1714; font-weight:300; font-style:italic; margin-bottom:16px; }
  .text { font-size:14px; color:#4a4039; line-height:1.8; margin-bottom:24px; }
  .coupon { background:#1C1714; color:#F7F3EE; padding:20px 40px; font-size:24px; letter-spacing:0.3em; font-family:monospace; display:inline-block; margin:16px 0 32px; }
  .btn { display:inline-block; background:#1C1714; color:#F7F3EE !important; text-decoration:none; padding:14px 40px; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; }
  .footer { background:#F7F3EE; padding:24px 40px; text-align:center; }
  .footer p { font-size:11px; color:#9A8878; line-height:1.8; margin:0; }
  .footer a { color:#B89B6A; text-decoration:none; }
`

async function sendWelcomeEmail(email) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>One Silk Ribbon</h1>
    <p>Handcrafted Mulberry Silk</p>
  </div>
  <div class="body">
    <p class="greeting">Welcome</p>
    <p class="text">Thank you for joining the One Silk Ribbon community.<br>Here is your exclusive discount code for 10% off your first order:</p>
    <div class="coupon">${COUPON_CODE}</div>
    <p class="text" style="font-size:12px;color:#9A8878;">Enter this code at checkout. Valid on your first order only.</p>
    <a href="https://onesilkribbon.com/collections" class="btn">Shop Now</a>
    <p class="text" style="margin-top:40px;font-size:13px;">
      Each ribbon is handcrafted from the finest mulberry silk — 
      made to bring a little beauty to your everyday moments.
    </p>
  </div>
  <div class="footer">
    <p><a href="https://onesilkribbon.com">onesilkribbon.com</a> · <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
    <p style="margin-top:8px;">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
  </div>
</div>
</body>
</html>`

  await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: email, subject: 'Your 10% welcome discount — One Silk Ribbon', html }),
  })
}

export async function POST(req) {
  try {
    const { email, source } = await req.json()
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

    // 检查是否已订阅
    const { data: existing } = await supabaseAdmin
      .from('subscribers')
      .select('id, status')
      .eq('email', email)
      .single()

    if (existing) {
      // 已存在但未激活，重新激活
      if (existing.status !== 'active') {
        await supabaseAdmin.from('subscribers').update({ status: 'active' }).eq('id', existing.id)
      }
      // 还是发欢迎邮件（可能换设备）
      await sendWelcomeEmail(email)
      return NextResponse.json({ ok: true })
    }

    // 新订阅者
    await supabaseAdmin.from('subscribers').insert({
      email,
      source: source || 'website',
      status: 'active',
      subscribed_at: new Date().toISOString(),
    })

    await sendWelcomeEmail(email)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
