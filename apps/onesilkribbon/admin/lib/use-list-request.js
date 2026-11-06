'use client'
// 列表页统一的请求状态：加载中、错误、取消旧请求、手动刷新。
// url 变化会重新请求；reload() 用于保存/删除后重新取当前页。
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export function useListRequest(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setData(null)
    setLoading(true)
    setError('')
    api(url, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(err => {
        if (!controller.signal.aborted && err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [url, reloadKey])

  const reload = useCallback(() => setReloadKey(key => key + 1), [])
  return { data, setData, loading, error, reload }
}
