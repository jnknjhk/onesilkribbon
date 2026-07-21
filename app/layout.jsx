import './globals.css'
import { Suspense } from 'react'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/components/CartProvider'
import { CartDrawer } from '@/components/CartDrawer'
import ShellWrapper from '@/components/ShellWrapper'
import WelcomePopup from '@/components/WelcomePopup'
import { AuthProvider } from '@/lib/auth'
import dynamic from 'next/dynamic'

const Navbar = dynamic(() => import('@/components/Navbar').then(m => ({ default: m.Navbar })), { ssr: false })


const organizationSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://onesilkribbon.com/#organization',
      name: 'One Silk Ribbon',
      url: 'https://onesilkribbon.com',
      logo: 'https://onesilkribbon.com/images/logo.png',
      contactPoint: { '@type': 'ContactPoint', email: 'song@onesilkribbon.com', contactType: 'customer service' },
      sameAs: ['https://www.instagram.com/onesilkribbon', 'https://www.pinterest.com/onesilkribbon'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://onesilkribbon.com/#website',
      url: 'https://onesilkribbon.com',
      name: 'One Silk Ribbon',
      publisher: { '@id': 'https://onesilkribbon.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://onesilkribbon.com/collections?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export const metadata = {
  title: {
    default: 'One Silk Ribbon — 100% Mulberry Silk Ribbons',
    template: '%s | One Silk Ribbon'
  },
  description: 'Handcrafted 100% pure mulberry silk ribbons. Six collections, 200+ colourways. Ethically made, shipped across the UK and Europe.',
  keywords: ['silk ribbon', 'mulberry silk', 'hand frayed ribbon', 'wedding ribbon', 'silk ribbon UK'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'One Silk Ribbon',
    description: 'Handcrafted 100% pure mulberry silk ribbons.',
    url: 'https://onesilkribbon.com',
    siteName: 'One Silk Ribbon',
    locale: 'en_GB',
    type: 'website',
    // 全站兜底分享图——没有自己声明 openGraph 的页面（/about、/contact 等）都会用这张。
    // 图片文件本身还没放进去，路径先接好：把 1200x630 的品牌图放到 public/og-image.jpg 即可生效。
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'One Silk Ribbon — Handcrafted Mulberry Silk Ribbons' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Silk Ribbon',
    description: 'Handcrafted 100% pure mulberry silk ribbons.',
    images: ['/og-image.jpg'],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <CartProvider>
          <AuthProvider>
            <ShellWrapper navbar={<Navbar />} cartDrawer={<CartDrawer />} footer={<Footer />}>
              {children}
            </ShellWrapper>
            <Suspense fallback={null}>
              <WelcomePopup />
            </Suspense>
          </AuthProvider>
        </CartProvider>
      </body>
    </html>
  )
}
