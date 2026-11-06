'use client'
// 后台统一上传入口：先压缩，再通过 api() 提交 FormData。
// 这样登录过期会走统一的 401 跳转，错误信息也和其它后台接口一致。
import { api } from './api'
import { compressImage, friendlyUploadError, MAX_UPLOAD_BYTES } from './compress-image'

export async function uploadMedia(file, namespace = 'general') {
  const compressed = await compressImage(file)
  if (compressed.size > MAX_UPLOAD_BYTES) throw new Error('图片太大，请压缩后重试')

  const form = new FormData()
  form.append('file', compressed)
  form.append('namespace', namespace)

  try {
    const data = await api('/api/admin/media', { method: 'POST', body: form })
    return data.media
  } catch (err) {
    throw new Error(friendlyUploadError(err))
  }
}
