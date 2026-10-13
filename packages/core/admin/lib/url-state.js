'use client'
// 列表页的页签 / 搜索 / 页码放在网址里：刷新不丢、能收藏、能把链接发给别人，
// 浏览器"返回"也能回到刚才那一页。
//
// 改网址用浏览器自己的 history.replaceState / pushState，而不是 router.replace / push：
// 后者每次都会先向服务器请求一遍页面（一个来回，线上几百毫秒），等它回来才轮到真正的数据请求，
// 而这些页面的内容只取决于数据接口。Next 14.1+ 会接管这两个方法，useSearchParams 照样同步更新，
// 前进 / 后退也正常。
import { useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function useUrlState(defaults = {}) {
  const params = useSearchParams()
  const pathname = usePathname()

  const get = useCallback(key => params.get(key) ?? defaults[key] ?? '', [params, defaults])

  const set = useCallback((patch, { replace = true } = {}) => {
    // 以地址栏当前的值为准：同一轮里连续调用两次 set 时，params 可能还没来得及更新
    const next = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '' || String(v) === String(defaults[k] ?? '')) next.delete(k)
      else next.set(k, String(v))
    }
    const qs = next.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    if (replace) window.history.replaceState(null, '', url)
    else {
      window.history.pushState(null, '', url)
      window.scrollTo(0, 0) // 打开详情（客户、文章）时回到顶部，和以前一样
    }
  }, [pathname, defaults])

  return [get, set]
}
