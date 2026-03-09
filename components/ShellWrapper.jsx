'use client'
import { usePathname } from 'next/navigation'
import CookieBanner from '@/components/CookieBanner'

export default function ShellWrapper({ children, navbar, cartDrawer, footer }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  if (isAdmin) return <>{children}</>

  return (
    <>
      {navbar}
      {cartDrawer}
      <main>{children}</main>
      {footer}
      <CookieBanner />
    </>
  )
}
