'use client'
// 列表页读数据用的 hook："先显示上次的，再悄悄刷新"。
// 回到几秒前看过的页面（比如从订单详情返回订单列表）时立刻有内容，不用再等一轮加载；
// 新数据回来后自动替换。第一次打开、或者刚做过修改（缓存已清空）时照常显示加载中。
//
// 编辑页、订单详情这类要在上面做操作的页面不要用它——它们必须以最新数据为准。
import { useCallback, useEffect, useState } from 'react'
import { api, peekCache } from './api'

// keepPrevious: 换到一个还没缓存过的地址时，是否先保留旧数据（列表换页签时保留，表格显示加载中；
// 详情页要传 false，免得新客户还没加载出来时显示的是上一个客户的资料）
// cache: false —— 不先显示上次的数据，每次都等最新的（列表上的数据会被原样拿去编辑保存时用，比如优惠码）
export function useApi(path, { keepPrevious = true, cache = true } = {}) {
  const peek = p => (cache && p ? peekCache(p) : undefined)
  const [data, setData] = useState(() => peek(path) ?? null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(() => !path || peek(path) === undefined)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const hit = peek(path)
    if (hit !== undefined) { setData(hit); setLoading(false) } else { setLoading(true); if (!keepPrevious) setData(null) }
    setError('')
    api(path)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [path, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setNonce(n => n + 1), [])
  return { data, error, loading, reload, setData }
}
