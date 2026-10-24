'use client'
import { useEffect } from 'react'

// Closing a menu must not unlock the page while the basket is still open.
let locks = 0
let previousOverflow = ''

export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      if (--locks === 0) document.body.style.overflow = previousOverflow
    }
  }, [locked])
}
