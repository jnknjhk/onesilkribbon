// 浏览器端压缩图片后再上传。
//
// 背景：后台上传接口 /api/admin/media 部署在 Vercel 的
// Serverless Function 上，请求体大小有平台强制上限（约 4.5MB，Next.js 配置改不了）。
// 手机相册原图普遍 5-15MB，直接传会被 Vercel 在到达我们代码之前就拒绝，
// 前端拿到的不是我们接口返回的 JSON，而是 Vercel 的错误页面，报错信息很难看懂。
// 所以上传前统一在客户端用 canvas 缩放 + 转 JPEG 压一遍。
export function compressImage(file, { maxDimension = 2000, quality = 0.85, skipIfUnder = 1.5 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/')) { resolve(file); return }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img

      // 已经够小、尺寸也不大，不用折腾
      if (width <= maxDimension && height <= maxDimension && file.size <= skipIfUnder) {
        resolve(file)
        return
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const targetW = Math.max(1, Math.round(width * scale))
      const targetH = Math.max(1, Math.round(height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, targetW, targetH)

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return } // 压缩失败就退回用原图，让上传接口自己兜底报错
        const compressed = new File(
          [blob],
          file.name.replace(/\.\w+$/, '.jpg'),
          { type: 'image/jpeg' }
        )
        resolve(compressed)
      }, 'image/jpeg', quality)
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// 压缩完还是太大（极少见，比如超高分辨率图仍然压不到位）就明确提示，而不是让它悄悄发出去再失败
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export function friendlyUploadError(err, res) {
  if (res && !res.ok && res.status === 413) return '图片太大，请压缩后重试'
  if (err && /json/i.test(err.message || '')) return '上传失败，图片可能过大，请压缩后重试'
  return '上传失败：' + (err?.message || '未知错误')
}
