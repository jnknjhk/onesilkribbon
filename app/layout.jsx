import './globals.css'
import { Suspense } from 'react'
import { Playfair_Display, Lora, Jost } from 'next/font/google'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/components/CartProvider'
import { CartDrawer } from '@/components/CartDrawer'
import ShellWrapper from '@/components/ShellWrapper'
import WelcomePopup from '@/components/WelcomePopup'
import { AuthProvider } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif-alt',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500'],
  variable: '--font-body',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
})


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
    default: 'One Silk Ribbon — Handmade Mulberry Silk Ribbons UK',
    template: '%s | One Silk Ribbon'
  },
  description: 'Handmade 100% mulberry silk ribbons for weddings, bouquets and gift wrapping. Hand-dyed in the UK, 200+ colourways, shipped across the UK and Europe.',
  keywords: [
    'silk ribbon UK', 'mulberry silk ribbon', 'hand-dyed silk ribbon', 'handmade silk ribbon',
    'wedding ribbon UK', 'bridal ribbon', 'florist ribbon supplies', 'hand frayed ribbon',
    'silk ribbon for bouquets', 'wedding stationery ribbon',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'One Silk Ribbon — Handmade Silk Ribbon UK',
    description: 'Handmade 100% mulberry silk ribbons for weddings, bouquets and gift wrapping. Hand-dyed in the UK.',
    url: 'https://onesilkribbon.com',
    siteName: 'One Silk Ribbon',
    locale: 'en_GB',
    type: 'website',
    // 全站兜底分享图——没有自己声明 openGraph 的页面（/about、/contact 等）都会用这张。
    // 图片文件本身还没放进去，路径先接好：把 1200x630 的品牌图放到 public/og-image.jpg 即可生效。
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'One Silk Ribbon — Handmade Mulberry Silk Ribbons UK' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Silk Ribbon — Handmade Silk Ribbon UK',
    description: 'Handmade 100% mulberry silk ribbons for weddings, bouquets and gift wrapping. Hand-dyed in the UK.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://onesilkribbon.com'),
}

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" className={`${playfairDisplay.variable} ${lora.variable} ${jost.variable}`}>
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
