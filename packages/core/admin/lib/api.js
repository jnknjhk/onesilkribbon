'use client'
// 后台页面调用 /api/admin/* 的统一入口：
//   · 非 2xx 一律抛错，错误信息取接口返回的 error 字段，页面只需要 try/catch + toast
//   · 401（登录过期）直接带回登录页，而不是让页面显示一堆"加载失败"
//   · 记住每个 GET 最近一次的结果（见 use-api.js：回到看过的页面先显示上次的数据，再在后台刷新）；
//     任何写操作（POST / PATCH / DELETE）之后整个清空，保证改完之后看到的都是新数据
export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

const memory = new Map() // GET 地址 -> 最近一次返回的数据
let generation = 0        // 每清空一次加 1：清空前发出的 GET 晚回来，也不会把旧数据写回去

export function peekCache(path) {
  return memory.get(path)
}

// 写操作之后、退出登录时清空。不走 api() 的写操作（比如直接用 fetch 上传图片）要自己调用
export function clearApiCache() {
  memory.clear()
  generation++
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const write = method !== 'GET'
  // 写操作一发出就清空：哪怕请求失败，也可能已经改了一部分
  if (write) clearApiCache()
  const gen = generation
  const res = await fetch(path, {
    method, signal,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  if (res.status === 401) {
    clearApiCache()
    if (typeof window !== 'undefined') window.location.href = '/admin-login'
    throw new ApiError('登录已过期，请重新登录', 401, data)
  }
  if (!res.ok) throw new ApiError(data?.error || `请求失败（${res.status}）`, res.status, data)
  if (write) clearApiCache() // 写完再清一次：写操作进行中发出的 GET 拿到的可能是改到一半的数据
  else if (gen === generation) {
    memory.set(path, data)
    if (memory.size > 60) memory.delete(memory.keys().next().value) // 只留最近 60 个
  }
  return data
}
