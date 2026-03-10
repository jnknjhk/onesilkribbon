import './globals.css'
import { Suspense } from 'react'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/components/CartProvider'
import { CartDrawer } from '@/components/CartDrawer'
import ShellWrapper from '@/components/ShellWrapper'
import WelcomePopup from '@/components/WelcomePopup'

export const metadata = {
  title: {
    default: 'One Silk Ribbon — 100% Mulberry Silk Ribbons',
    template: '%s | One Silk Ribbon'
  },
  description: 'Handcrafted 100% pure mulberry silk ribbons. Six collections, 200+ colourways. Ethically made, shipped across the UK and Europe.',
  keywords: ['silk ribbon', 'mulberry silk', 'hand frayed ribbon', 'wedding ribbon', 'silk ribbon UK'],
  openGraph: {
    title: 'One Silk Ribbon',
    description: 'Handcrafted 100% pure mulberry silk ribbons.',
    url: 'https://onesilkribbon.com',
    siteName: 'One Silk Ribbon',
    locale: 'en_GB',
    type: 'website',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://onesilkribbon.com'),
}

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <CartProvider>
          <ShellWrapper navbar={<Navbar />} cartDrawer={<CartDrawer />} footer={<Footer />}>
            {children}
          </ShellWrapper>
          <Suspense fallback={null}>
            <WelcomePopup />
          </Suspense>
        </CartProvider>
      </body>
    </html>
  )
}
