'use client'
// 侧边栏和订单页共用的订单计数。只请求一次 countsOnly，避免每个页面各算一遍。
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { api } from '../lib/api'

const AdminCountsCtx = createContext({ counts: null, refresh: () => {} })
const CACHE_TTL = 30_000
let cachedCounts = null
let cachedAt = 0

export function AdminCountsProvider({ children }) {
  const pathname = usePathname()
  const [counts, setCounts] = useState(cachedCounts)
  const controllerRef = useRef(null)

  const load = useCallback(async (force = false) => {
    if (!force && cachedCounts && Date.now() - cachedAt < CACHE_TTL) {
      setCounts(cachedCounts)
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const data = await api('/api/admin/orders?countsOnly=1', { signal: controller.signal })
      if (!controller.signal.aborted) {
        cachedCounts = data.counts || {}
        cachedAt = Date.now()
        setCounts(cachedCounts)
      }
    } catch (err) {
      // 计数失败时保留上一次的数字，不把侧边栏角标清零
      if (!controller.signal.aborted && err.name !== 'AbortError') console.error('读取订单计数失败', err)
    }
  }, [])

  useEffect(() => {
    load()
    return () => controllerRef.current?.abort()
  }, [pathname, load])

  const refresh = useCallback(() => load(true), [load])

  return <AdminCountsCtx.Provider value={{ counts, refresh }}>{children}</AdminCountsCtx.Provider>
}

export function useAdminCounts() {
  return useContext(AdminCountsCtx)
}

export function clearAdminCountsCache() {
  cachedCounts = null
  cachedAt = 0
}
