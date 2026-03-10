import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'One Silk Ribbon <song@onesilkribbon.com>'

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

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/verify-email?token=${token}`
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head>
<body><div class="wrapper">
  <div class="header"><h1>One Silk Ribbon</h1><p>Handcrafted Mulberry Silk</p></div>
  <div class="body">
    <p style="font-family:'Georgia',serif;font-size:28px;font-style:italic;color:#1C1714;font-weight:300;margin-bottom:16px">Almost there</p>
    <p class="text">Please confirm your email address to receive your exclusive 10% welcome discount.</p>
    <a href="${verifyUrl}" class="btn">Confirm My Email</a>
    <p class="text" style="font-size:12px;color:#9A8878">This link expires in 24 hours.<br>If you didn't subscribe, you can safely ignore this email.</p>
  </div>
  <div class="footer">
    <p><a href="https://onesilkribbon.com">onesilkribbon.com</a> · <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
    <p style="margin-top:8px">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
  </div>
</div></body></html>`

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: email, subject: 'Please confirm your email — One Silk Ribbon', html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Email send failed')
}

export async function POST(req) {
  try {
    const { email, source } = await req.json()

    // 格式验证
    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // 拦截假域名
    const domain = email.split('@')[1]?.toLowerCase()
    if (BLOCKED_DOMAINS.includes(domain)) {
      return NextResponse.json({ error: 'Please use a real email address' }, { status: 400 })
    }

    // 生成 token，24小时有效
    const token      = randomBytes(32).toString('hex')
    const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // 检查是否已存在
    const { data: existing } = await supabaseAdmin
      .from('subscribers')
      .select('id, verified, status')
      .eq('email', email)
      .single()

    if (existing) {
      if (existing.verified) {
        // 已验证过，不重复发码
        return NextResponse.json({ ok: true, already: true })
      }
      // 未验证，更新 token 重新发验证邮件
      await supabaseAdmin.from('subscribers').update({
        verify_token:     token,
        token_expires_at: expiresAt,
        status:           'pending',
      }).eq('id', existing.id)
    } else {
      // 新订阅者
      await supabaseAdmin.from('subscribers').insert({
        email,
        source:           source || 'welcome_popup',
        status:           'pending',
        verified:         false,
        verify_token:     token,
        token_expires_at: expiresAt,
      })
    }

    await sendVerificationEmail(email, token)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: 'Something went wrong, please try again' }, { status: 500 })
  }
}
