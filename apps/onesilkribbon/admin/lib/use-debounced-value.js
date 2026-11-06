'use client'
import { useEffect, useState } from 'react'

// 把输入值延迟一段时间再用于请求，避免每敲一个字都打一次接口。
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
