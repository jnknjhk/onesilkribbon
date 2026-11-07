'use client'
// 后台页面调用 /api/admin/* 的统一入口：
//   · 非 2xx 一律抛错，错误信息取接口返回的 error 字段，页面只需要 try/catch + toast
//   · 401（登录过期）直接带回登录页，而不是让页面显示一堆"加载失败"
class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

export async function api(path, { method = 'GET', body, signal, cache } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(path, {
    method, signal, cache,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/admin-login'
    throw new ApiError('登录已过期，请重新登录', 401, data)
  }
  // errorResponse() 的兜底文案是给前台用的英文；后台统一翻成中文，避免中英混排
  const GENERIC_ERROR = 'Something went wrong. Please try again.'
  const message = data?.error === GENERIC_ERROR ? '操作失败，请重试' : (data?.error || `请求失败（${res.status}）`)
  if (!res.ok) throw new ApiError(message, res.status, data)
  return data
}
