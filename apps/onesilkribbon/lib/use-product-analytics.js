'use client'
import { useEffect, useRef } from 'react'
import { CONSENT_EVENT } from '@/lib/consent'
import { trackProductEvent } from '@/lib/storefront-analytics'

export function useProductAnalytics(product, sku) {
  const viewed = useRef(new Set())
  useEffect(() => {
    const view = () => {
      if (!product?.id || viewed.current.has(product.id)) return
      if (trackProductEvent('view_item', product, sku)) viewed.current.add(product.id)
    }
    view()
    window.addEventListener(CONSENT_EVENT, view)
    window.addEventListener('storage', view)
    return () => {
      window.removeEventListener(CONSENT_EVENT, view)
      window.removeEventListener('storage', view)
    }
  }, [product, sku])
}
