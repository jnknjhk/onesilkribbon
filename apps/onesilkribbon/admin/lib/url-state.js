'use client'
// 列表页的页签 / 搜索 / 页码放在网址里：刷新不丢、能收藏、能把链接发给别人，
// 浏览器"返回"也能回到刚才那一页。
import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function useUrlState(defaults = {}) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const get = useCallback(key => params.get(key) ?? defaults[key] ?? '', [params, defaults])

  const set = useCallback((patch, { replace = true } = {}) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '' || String(v) === String(defaults[k] ?? '')) next.delete(k)
      else next.set(k, String(v))
    }
    const qs = next.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    replace ? router.replace(url, { scroll: false }) : router.push(url)
  }, [params, pathname, router, defaults])

  return [get, set]
}
