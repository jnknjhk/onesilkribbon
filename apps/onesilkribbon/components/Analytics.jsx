'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { GoogleAnalytics } from '@next/third-parties/google'
import { CONSENT_EVENT, hasConsented } from '@/lib/consent'
import { GA_ID, flushProductEvents, isPrivateAnalyticsPath } from '@/lib/storefront-analytics'

// 同意门控的 GA4：只有访客在 Cookie 横幅上点过 "Accept" 之后才加载 gtag。
// 站点面向英国/欧洲，PECR + UK GDPR 要求分析类 cookie 必须先取得同意，
// 所以默认不加载——未选择、已拒绝、localStorage 不可用时一律不加载。
export default function Analytics() {
  const [consented, setConsented] = useState(false)
  const pathname = usePathname() || ''
  const privatePage = isPrivateAnalyticsPath(pathname)

  useEffect(() => {
    // Also disable an already-loaded tag when navigating into a private flow.
    window[`ga-disable-${GA_ID}`] = !consented || privatePage
    flushProductEvents()
    if (!consented || privatePage) return
    // The consent-gated inline Google tag may initialize after product effects.
    // Keep only a bounded, in-memory queue of events accepted after consent.
    let attempts = 0
    const timer = setInterval(() => {
      flushProductEvents()
      if (typeof window.gtag === 'function' || ++attempts >= 60) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  },[consented,privatePage,pathname])

  useEffect(() => {
    const read = () => {
      flushProductEvents()
      setConsented(hasConsented())
    }
    read()

    window.addEventListener(CONSENT_EVENT, read)   // 本页点击 Accept/Decline
    window.addEventListener('storage', read)        // 其他标签页里改了选择
    return () => {
      window.removeEventListener(CONSENT_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [])

  // 自己在后台的操作不算网站访问量
  if (!consented || privatePage) return null
  return <GoogleAnalytics gaId={GA_ID} />
}
