import { supabaseAdmin } from '@/lib/supabase'
import { redirect } from 'next/navigation'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'One Silk Ribbon <song@onesilkribbon.com>'

const styles = `
  body{margin:0;padding:0;background:#F7F3EE;font-family:'Georgia',serif}
  .wrapper{max-width:600px;margin:0 auto;background:#fff}
  .header{background:#1C1714;padding:32px 40px;text-align:center}
  .header h1{color:#F7F3EE;font-size:22px;font-weight:300;letter-spacing:.3em;margin:0;text-transform:uppercase}
  .header p{color:#B89B6A;font-size:11px;letter-spacing:.2em;margin:8px 0 0;text-transform:uppercase}
  .body{padding:40px;text-align:center}
  .text{font-size:14px;color:#4a4039;line-height:1.8;margin-bottom:24px}
  .coupon{background:#1C1714;color:#F7F3EE;padding:20px 40px;font-size:24px;letter-spacing:.3em;font-family:monospace;display:inline-block;margin:16px 0 32px}
  .btn{display:inline-block;background:#1C1714;color:#F7F3EE!important;text-decoration:none;padding:14px 40px;font-size:11px;letter-spacing:.2em;text-transform:uppercase}
  .footer{background:#F7F3EE;padding:24px 40px;text-align:center}
  .footer p{font-size:11px;color:#9A8878;line-height:1.8;margin:0}
  .footer a{color:#B89B6A;text-decoration:none}
`

function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'WELCOME-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function sendCouponEmail(email, couponCode) {
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head>
<body><div class="wrapper">
  <div class="header"><h1>One Silk Ribbon</h1><p>Handcrafted Mulberry Silk</p></div>
  <div class="body">
    <p style="font-family:'Georgia',serif;font-size:28px;font-style:italic;color:#1C1714;font-weight:300;margin-bottom:16px">Welcome</p>
    <p class="text">Thank you for confirming your email.<br>Here is your exclusive 10% discount code for your first order:</p>
    <div class="coupon">${couponCode}</div>
    <p class="text" style="font-size:12px;color:#9A8878;margin-bottom:32px">This code is unique to you and can only be used once.<br>Enter it at checkout to receive 10% off your first order.</p>
    <a href="https://onesilkribbon.com/collections" class="btn">Start Shopping</a>
    <p class="text" style="margin-top:40px;font-size:13px">Each ribbon is handcrafted from the finest mulberry silk — made to bring a little beauty to your everyday moments.</p>
  </div>
  <div class="footer">
    <p><a href="https://onesilkribbon.com">onesilkribbon.com</a> · <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
    <p style="margin-top:8px">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
  </div>
</div></body></html>`

  await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: email, subject: `Your exclusive welcome code — One Silk Ribbon`, html }),
  })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) redirect('/?verified=error')

  // 查找 token
  const { data: subscriber } = await supabaseAdmin
    .from('subscribers')
    .select('*')
    .eq('verify_token', token)
    .single()

  if (!subscriber) redirect('/?verified=invalid')

  // 检查是否过期
  if (new Date(subscriber.token_expires_at) < new Date()) redirect('/?verified=expired')

  // 已验证过
  if (subscriber.verified) redirect('/?verified=already')

  // 生成唯一优惠码
  let couponCode, attempts = 0
  do {
    couponCode = generateCouponCode()
    const { data: existing } = await supabaseAdmin.from('coupons').select('id').eq('code', couponCode).single()
    if (!existing) break
    attempts++
  } while (attempts < 10)

  // 写入 coupons 表
  await supabaseAdmin.from('coupons').insert({
    code:           couponCode,
    description:    `Welcome discount for ${subscriber.email}`,
    discount_type:  'percentage',
    discount_value: 10,
    min_order_gbp:  0,
    max_uses:       1,
    uses_count:     0,
    active:         true,
    expires_at:     null,
  })

  // 更新 subscriber
  await supabaseAdmin.from('subscribers').update({
    verified:         true,
    status:           'active',
    verify_token:     null,
    token_expires_at: null,
    coupon_code:      couponCode,
    subscribed_at:    new Date().toISOString(),
  }).eq('id', subscriber.id)

  // 同步写入 customers 表
  const { data: existingCustomer } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('email', subscriber.email)
    .single()

  if (!existingCustomer) {
    await supabaseAdmin.from('customers').insert({
      email:      subscriber.email,
      source:     subscriber.source || 'welcome_popup',
      created_at: new Date().toISOString(),
    })
  }

  // 发送优惠码邮件
  await sendCouponEmail(subscriber.email, couponCode)

  // redirect 必须在 try/catch 外部调用
  redirect(`/?verified=success&code=${couponCode}`)
}
