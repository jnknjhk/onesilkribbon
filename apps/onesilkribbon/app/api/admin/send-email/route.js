import { verifyAdmin } from '@/admin/auth'
import { siteConfig } from '@/admin/site-config'
import { errorResponse } from '@osr/core/lib/api-error'
import { escapeHtml } from '@osr/core/lib/escape-html'
import { sendEmail } from '@/lib/email'
import { validateEmailAttachments, validateEmailAttachmentDetails } from '@/admin/lib/email-attachments'
import { prepareEmailAttachmentUploads, readEmailAttachments, removeEmailAttachmentUploads, validEmailAttachmentIds } from '@/admin/lib/email-attachment-storage'

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
  const { brand, tagline, siteUrl, ownerEmail } = siteConfig
  const siteLabel = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${styles}</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>${brand}</h1>
    <p>${tagline}</p>
  </div>
  <div class="body">
    <p class="text">${escapeHtml(body).replace(/\n/g, '<br>')}</p>
    <hr class="divider">
    <p style="font-size:12px;color:#9A8878;">
      Questions? Contact us at <a href="mailto:${ownerEmail}" style="color:#B89B6A;">${ownerEmail}</a>
    </p>
  </div>
  <div class="footer">
    <p>
      <a href="${siteUrl}">${siteLabel}</a> &nbsp;·&nbsp;
      <a href="mailto:${ownerEmail}">${ownerEmail}</a>
    </p>
    <p style="margin-top:8px;">© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
  </div>
</div>
</body>
</html>`
}

export async function POST(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const multipart = /^multipart\/form-data(?:\s*;|$)/i.test(req.headers.get('content-type') || '')
    if (multipart && Number(req.headers.get('content-length')) > 4_400_000) {
      return Response.json({ error: '附件和邮件内容合计过大，请减小附件后重试' }, { status: 413 })
    }
    let input
    try {
      input = multipart ? await req.formData() : await req.json()
    } catch {
      return Response.json({ error: '无法读取邮件内容，请重新选择附件后重试' }, { status: 400 })
    }
    const { to, subject, body } = multipart
      ? { to: input.get('to'), subject: input.get('subject'), body: input.get('body') }
      : (input || {})
    if (![to, subject, body].every(value => typeof value === 'string' && value.trim())) {
      return Response.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const files = multipart ? input.getAll('attachments') : (input.attachments ?? [])
    const attachmentError = multipart ? validateEmailAttachments(files) : validateEmailAttachmentDetails(files)
    if (attachmentError) return Response.json({ error: attachmentError }, { status: 400 })
    if (multipart && files.reduce((total, file) => total + file.size, 0) > 4_194_304) {
      return Response.json({ error: '请刷新页面后重新添加大附件' }, { status: 413 })
    }
    const ids = multipart ? [] : files.map(file => file.id)
    if (ids.length && !validEmailAttachmentIds(ids)) return Response.json({ error: '附件引用无效' }, { status: 400 })
    let attachments = []
    if (files.length) {
      attachments = multipart
        ? await Promise.all(files.map(async file => ({
            filename: file.name,
            content: Buffer.from(await file.arrayBuffer()).toString('base64'),
          })))
        : await readEmailAttachments(admin.email, files)
    }
    if (!attachments) return Response.json({ error: '附件上传未完成，请重试' }, { status: 409 })
    const html = buildHtml(subject, body)

    await sendEmail({ to: to.trim(), cc: siteConfig.ownerEmail, subject, html, kind: 'marketing', attachments })
    if (ids.length) {
      try { await removeEmailAttachmentUploads(admin.email, ids) }
      catch (error) { console.error('Email attachment cleanup failed', error?.status) }
    }
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-send-email' })
  }
}

export async function PUT(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const files = await req.json().catch(() => null)
  const message = validateEmailAttachmentDetails(files)
  if (message) return Response.json({ error: message }, { status: 400 })
  try {
    const uploads = await prepareEmailAttachmentUploads(admin.email, files.length)
    return Response.json({ uploads }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-email-attachments-prepare' })
  }
}

export async function DELETE(req) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const ids = await req.json().catch(() => null)
  if (!validEmailAttachmentIds(ids)) return Response.json({ error: '附件引用无效' }, { status: 400 })
  try {
    await removeEmailAttachmentUploads(admin.email, ids)
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err, { tag: 'admin-email-attachments-remove' })
  }
}
