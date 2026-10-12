import { supabaseAdmin } from '@osr/core/lib/supabase'
import { escapeHtml } from '@osr/core/lib/escape-html'
import { logEmail } from '@/lib/email-log'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'One Silk Ribbon <song@onesilkribbon.com>'

// 和联系页输入框的 maxLength 保持一致
const MAX_LEN = { name: 100, email: 254, subject: 200, message: 5000 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 频率上限。这个接口不用登录、会以本站名义发邮件，不设上限就能被拿来刷：
// 给站主灌垃圾留言、或者让自动回复发到任意邮箱。按 email_log 里已经发过的记录算，
// 所以多台服务器实例之间也是同一个计数。
const ENQUIRIES_PER_HOUR = 30            // 全站每小时最多收这么多条留言
const AUTOREPLIES_PER_HOUR = 20          // 全站每小时最多发这么多封自动回复
const AUTOREPLIES_PER_ADDRESS_PER_DAY = 2 // 同一个邮箱一天最多收到这么多封自动回复

// 最近一段时间内某类邮件发了多少封。查询出错（比如 email_log 表还没建）时按 0 算——
// 宁可放过，也不能因为计数查不了就把真实客户的留言挡在外面。
async function countRecent({ kind, sinceMs, to }) {
  let query = supabaseAdmin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind)
    .gte('created_at', new Date(Date.now() - sinceMs).toISOString())
  if (to) query = query.eq('to_email', to)
  const { count, error } = await query
  if (error) {
    console.error('[contact] 发信计数查询失败（按 0 处理）:', error.message)
    return 0
  }
  return count || 0
}

// 自动回复会发到表单里填的任意邮箱，所以邮件里不能出现对方能控制的内容——
// 否则别人可以借本站的发件地址，给任何人发一封写着他想写的话的邮件。
// 称呼只保留名字第一个词里的字母，没有就不带称呼。
function greetingName(name) {
  const first = String(name).trim().split(/\s+/)[0] || ''
  return first.replace(/[^\p{L}\p{M}'’-]/gu, '').slice(0, 30)
}

// 邮件标题是纯文本，去掉换行等控制字符
const oneLine = (s) => String(s).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim()

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

    const HOUR = 60 * 60 * 1000
    const [enquiriesLastHour, repliesLastHour, repliesToAddress] = await Promise.all([
      countRecent({ kind: 'contact', sinceMs: HOUR }),
      countRecent({ kind: 'contact_autoreply', sinceMs: HOUR }),
      countRecent({ kind: 'contact_autoreply', sinceMs: 24 * HOUR, to: email }),
    ])

    if (enquiriesLastHour >= ENQUIRIES_PER_HOUR) {
      console.error('[contact] 每小时留言数已达上限，拒绝本次提交')
      return Response.json({
        error: "We're receiving a lot of messages right now. Please email us directly at song@onesilkribbon.com.",
      }, { status: 429 })
    }

    // Email to owner — 所有用户填写的内容都先转义
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
      <div class="footer">Sent via onesilkribbon.com contact form</div>
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
      <div class="header"><h1>One Silk Ribbon</h1><p>Handcrafted Mulberry Silk</p></div>
      <div class="body">
        <p style="font-family:'Georgia',serif;font-size:28px;font-style:italic;color:#1C1714;font-weight:300;margin-bottom:16px">Thank you${greet ? `, ${escapeHtml(greet)}` : ''}</p>
        <p class="text">We have received your message and will get back to you within 2 working days.</p>
        <p class="text" style="font-size:13px;color:#9A8878">If your enquiry is urgent, please email us directly at<br><a href="mailto:song@onesilkribbon.com" style="color:#B89B6A">song@onesilkribbon.com</a></p>
      </div>
      <div class="footer">
        <p><a href="https://onesilkribbon.com">onesilkribbon.com</a> · <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a></p>
        <p style="margin-top:8px">© ${new Date().getFullYear()} One Silk Ribbon. All rights reserved.</p>
      </div>
    </div></body></html>`

    // 之前这两个 fetch 的响应完全没检查——Resend 返回错误也会被当成发送成功，
    // 客户看到"已收到你的留言"，而你那边其实什么都没收到。现在逐封检查并落库。
    async function send({ to, replyTo, subject: subj, html, kind }) {
      try {
        const res = await fetch(RESEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: FROM, to, ...(replyTo ? { reply_to: replyTo } : {}), subject: subj, html }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Email send failed')
        await logEmail({ kind, to, subject: subj, status: 'sent', providerId: data.id })
        return true
      } catch (e) {
        await logEmail({ kind, to, subject: subj, status: 'failed', error: e.message })
        return false
      }
    }

    // 超过上限就只是不发自动回复，留言照常送到站主；对客户的响应保持一样，
    // 不让刷接口的人看出自己被限了
    const sendReply = repliesLastHour < AUTOREPLIES_PER_HOUR &&
                      repliesToAddress < AUTOREPLIES_PER_ADDRESS_PER_DAY
    if (!sendReply) console.error('[contact] 自动回复已达频率上限，本次跳过', { email })

    const [ownerSent, replySent] = await Promise.all([
      send({ to: 'song@onesilkribbon.com', replyTo: email, subject: oneLine(`New Enquiry: ${subject || 'Website Contact'} — ${name}`), html: ownerHtml, kind: 'contact' }),
      sendReply
        ? send({ to: email, subject: 'We received your message — One Silk Ribbon', html: replyHtml, kind: 'contact_autoreply' })
        : Promise.resolve(true),
    ])

    // 给站主的那封才是关键——它没发出去就等于这条留言丢了，必须让客户知道
    if (!ownerSent) {
      return Response.json({ error: 'Failed to send message' }, { status: 500 })
    }
    // 自动回复失败不影响留言本身已送达，不用打扰客户
    if (!replySent) console.error('[contact] 自动回复发送失败，但留言已送达站主')

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return Response.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
