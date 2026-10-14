import { supabaseAdmin } from '@osr/core/lib/supabase'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = `One Silk Ribbon <${process.env.EMAIL_FROM || 'song@onesilkribbon.com'}>`

// 拦截明显假域名
const BLOCKED_DOMAINS = ['test.com','fake.com','example.com','mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com','sharklasers.com','trashmail.com']

const styles = `
  body{margin:0;padding:0;background:#F7F3EE;font-family:'Georgia',serif}
  .wrapper{max-width:600px;margin:0 auto;background:#fff}
  .header{background:#1C1714;padding:32px 40px;text-align:center}
  .header h1{color:#F7F3EE;font-size:22px;font-weight:300;letter-spacing:.3em;margin:0;text-transform:uppercase}
  .header p{color:#B89B6A;font-size:11px;letter-spacing:.2em;margin:8px 0 0;text-transform:uppercase}
  .body{padding:40px;text-align:center}
  .text{font-size:14px;color:#4a4039;line-height:1.8;margin-bottom:24px}
  .btn{display:inline-block;background:#1C1714;color:#F7F3EE!important;text-decoration:none;padding:16px 48px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin:8px 0 32px}
  .footer{background:#F7F3EE;padding:24px 40px;text-align:center}
  .footer p{font-size:11px;color:#9A8878;line-height:1.8;margin:0}
  .footer a{color:#B89B6A;text-decoration:none}
`

async function sendVerificationEmail(email, token, requestId, createdAt) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/verify-email?token=${token}`
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head>
<body><div class="wrapper">
  <div class="header"><h1>One Silk Ribbon</h1><p>Handcrafted Mulberry Silk</p></div>
  <div class="body">
    <p style="font-family:'Georgia',serif;font-size:28px;font-style:italic;color:#1C1714;font-weight:300;margin-bottom:16px">Almost there</p>
    <p class="text">Please confirm your email address to receive your exclusive 10% welcome discount.</p>
    <a href="${verifyUrl}" class="btn">Confirm My Email</a>
    <p class="text" style="font-size:12px;color:#9A8878">This link is valid for up to 24 hours from your first request.<br>If you didn't subscribe, you can safely ignore this email.</p>
  </div>
  <div class="footer">
    <p><a href="https://onesilkribbon.com">onesilkribbon.com</a> · <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
    <p style="margin-top:8px">© ${new Date(createdAt).getUTCFullYear()} One Silk Ribbon. All rights reserved.</p>
  </div>
</div></body></html>`

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Idempotency-Key': `subscription/${requestId}` },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ from: FROM, to: email, subject: 'Please confirm your email — One Silk Ribbon', html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Email send failed')
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  try {
    const { email: rawEmail, source } = body || {}
    // 统一归一化（trim + 小写），避免同一邮箱因大小写/空格不同被当成两个订阅者
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''

    // 格式验证
    if (!email || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // 拦截假域名
    const domain = email.split('@')[1]
    if (BLOCKED_DOMAINS.includes(domain)) {
      return NextResponse.json({ error: 'Please use a real email address' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) throw new Error('Email service unavailable')
    const { data: request, error } = await supabaseAdmin.rpc('prepare_subscription_email', {
      p_email: email,
      p_source: typeof source === 'string' ? source.slice(0, 80) : 'welcome_popup',
      p_token: randomBytes(32).toString('hex'),
    })
    if (error || !request) throw new Error('Subscription preparation unavailable')
    if (request.limited) return NextResponse.json({ error: 'Please wait before requesting another email.' },
      { status: 429, headers: { 'Retry-After': String(request.retry_after) } })
    // Do not reveal whether an address was already verified.
    if (request.skip) return NextResponse.json({ ok: true })
    await sendVerificationEmail(request.email, request.verify_token, request.id, request.created_at)
    const { error: saveError } = await supabaseAdmin.from('subscription_email_requests')
      .update({ sent_at: new Date().toISOString() }).eq('id', request.id)
    if (saveError) throw new Error('Email delivery acknowledgement unavailable')
    return NextResponse.json({ ok: true })

  } catch (err) {
    // Never log subscriber addresses, verification links or provider response bodies.
    console.error('Subscription request failed; retry is safe')
    return NextResponse.json({ error: 'Email delivery could not be confirmed. Please wait a minute and try again.' }, { status: 503 })
  }
}
