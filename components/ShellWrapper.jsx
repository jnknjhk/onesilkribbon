'use client'
import { usePathname } from 'next/navigation'

export default function ShellWrapper({ children, navbar, cartDrawer, footer, cookieBanner }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  if (isAdmin) return <>{children}</>

  return (
    <>
      {navbar}
      {cartDrawer}
      <main>{children}</main>
      {footer}
      {cookieBanner}
    </>
  )
}
