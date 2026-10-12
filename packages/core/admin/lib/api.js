'use client'
// 后台页面调用 /api/admin/* 的统一入口：
//   · 非 2xx 一律抛错，错误信息取接口返回的 error 字段，页面只需要 try/catch + toast
//   · 401（登录过期）直接带回登录页，而不是让页面显示一堆"加载失败"
export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(path, {
    method, signal,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/admin-login'
    throw new ApiError('登录已过期，请重新登录', 401, data)
  }
  if (!res.ok) throw new ApiError(data?.error || `请求失败（${res.status}）`, res.status, data)
  return data
}
