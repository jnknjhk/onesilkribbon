'use client'
import { createSupabaseBrowserClient } from '@osr/core/lib/supabase-browser'
import { api } from './api'
import { EMAIL_ATTACHMENT_BUCKET } from './email-attachments'

const endpoint = '/api/admin/send-email'

export async function sendAdminEmail(fields, files) {
  if (!files.length) return api(endpoint, { method: 'POST', body: fields })

  const details = files.map(({ name, size }) => ({ name, size }))
  const { uploads } = await api(endpoint, { method: 'PUT', body: details })
  try {
    const bucket = createSupabaseBrowserClient().storage.from(EMAIL_ATTACHMENT_BUCKET)
    for (const [index, file] of files.entries()) {
      const { path, token } = uploads[index]
      const { error } = await bucket.uploadToSignedUrl(path, token, file)
      if (error) throw new Error(`附件上传失败：${file.name}，请重试`)
    }
    const attachments = details.map((file, index) => ({ ...file, id: uploads[index].id }))
    return await api(endpoint, { method: 'POST', body: { ...fields, attachments } })
  } catch (error) {
    await api(endpoint, { method: 'DELETE', body: uploads.map(upload => upload.id) }).catch(() => {})
    throw error
  }
}
