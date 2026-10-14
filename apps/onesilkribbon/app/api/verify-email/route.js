import { supabaseAdmin } from '@osr/core/lib/supabase'
import { redirect } from 'next/navigation'
import { errorResponse } from '@osr/core/lib/api-error'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = `One Silk Ribbon <${process.env.EMAIL_FROM || 'song@onesilkribbon.com'}>`

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

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Idempotency-Key': `welcome/${couponCode}` },
    body: JSON.stringify({ from: FROM, to: email, subject: `Your exclusive welcome code — One Silk Ribbon`, html }),
  })
  if (!response.ok) throw new Error('Welcome email failed')
}

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect('/?verified=invalid')
  let code
  try {
    const { data: claim, error } = await supabaseAdmin.rpc('claim_welcome_coupon', { p_token: token })
    if (error) {
      if (error.code === 'P0001') redirect('/?verified=invalid')
      throw error
    }
    code = claim.coupon_code
    if (!claim.emailed_at) {
      await sendCouponEmail(claim.email, code)
      const { error: saveError } = await supabaseAdmin.from('welcome_coupon_claims')
        .update({ emailed_at: new Date().toISOString() }).eq('token', token)
      if (saveError) throw saveError
    }
  } catch (err) {
    // redirect() throws: propagate it instead of converting it into a database error.
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    return errorResponse(err, { status: 503, tag: 'welcome-coupon',
      message: 'Verification is pending. Your existing code is retained; refresh this same link to retry.' })
  }
  redirect('/?verified=success&code=' + encodeURIComponent(code))
}
