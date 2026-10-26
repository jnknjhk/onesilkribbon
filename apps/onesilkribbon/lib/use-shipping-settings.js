'use client'
import { useState, useEffect, useCallback } from 'react'
import { shippingSettingsFromApi } from '@/lib/pricing'

export function useShippingSettings(initialSettings = null) {
  const [settings, setSettings] = useState(initialSettings)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(value => value + 1), [])

  useEffect(() => {
    setError(false)
    if (initialSettings && attempt === 0) {
      setSettings(initialSettings)
      return
    }
    setSettings(null)
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      if (active) {
        setError(true)
        controller.abort()
      }
    }, 10000)
    fetch('/api/settings', { signal: controller.signal, cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Delivery charges unavailable')
        return response.json()
      })
      .then(data => {
        if (active && !controller.signal.aborted) setSettings(shippingSettingsFromApi(data))
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => clearTimeout(timeout))
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt, initialSettings])

  return { settings, error, retry }
}
