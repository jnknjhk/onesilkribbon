export const MAX_EMAIL_ATTACHMENTS = 5
export const MAX_EMAIL_ATTACHMENT_BYTES = 4 * 1024 * 1024
export const EMAIL_ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx,.txt,.csv'

const extensions = new Set(EMAIL_ATTACHMENT_ACCEPT.split(','))

export function validateEmailAttachments(files) {
  if (files.length > MAX_EMAIL_ATTACHMENTS) return '每封邮件最多添加 5 个附件'

  let total = 0
  for (const file of files) {
    if (!(file instanceof File)) return '附件必须是文件'
    const { name, size } = file
    if (name.length > 180 || /[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/u.test(name)) {
      return '附件文件名过长或包含不支持的字符'
    }
    const dot = name.lastIndexOf('.')
    if (dot <= 0 || !extensions.has(name.slice(dot).toLowerCase())) return `不支持此附件格式：${name}`
    if (size === 0) return `附件为空：${name}`
    total += size
  }
  if (total > MAX_EMAIL_ATTACHMENT_BYTES) return '附件合计不能超过 4 MB'
  return ''
}
