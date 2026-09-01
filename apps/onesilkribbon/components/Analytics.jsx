'use client'
import { useState, useEffect } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { CONSENT_EVENT, hasConsented } from '@/lib/consent'

const GA_ID = 'G-D48ERTWLOR'

// 同意门控的 GA4：只有访客在 Cookie 横幅上点过 "Accept" 之后才加载 gtag。
// 站点面向英国/欧洲，PECR + UK GDPR 要求分析类 cookie 必须先取得同意，
// 所以默认不加载——未选择、已拒绝、localStorage 不可用时一律不加载。
export default function Analytics() {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    const read = () => setConsented(hasConsented())
    read()

    window.addEventListener(CONSENT_EVENT, read)   // 本页点击 Accept/Decline
    window.addEventListener('storage', read)        // 其他标签页里改了选择
    return () => {
      window.removeEventListener(CONSENT_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [])

  if (!consented) return null
  return <GoogleAnalytics gaId={GA_ID} />
}
