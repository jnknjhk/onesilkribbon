import './globals.css'
import { Suspense } from 'react'
import { Playfair_Display, Lora, Jost } from 'next/font/google'
import Analytics from '@/components/Analytics'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/components/CartProvider'
import { CartDrawer } from '@/components/CartDrawer'
import ShellWrapper from '@osr/core/components/ShellWrapper'
import WelcomePopup from '@/components/WelcomePopup'
import CookieBanner from '@/components/CookieBanner'
import { AuthProvider } from '@osr/core/lib/auth'
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
      // 这里原来声明了 SearchAction，指向 /collections?q={search_term_string}，
      // 但 /collections 根本不读 q 参数（站内搜索实际走 /api/search），
      // 等于向 Google 申报了一个不存在的能力。而且 Google 已在 2023 年底
      // 下线 sitelinks searchbox，这个声明既无效又拉低结构化数据的可信度，
      // 而商品页的 Product/ProductGroup 才是真正需要被信任的那部分。故移除。
    },
  ],
}

export const metadata = {
  title: {
    default: 'One Silk Ribbon — Handmade Mulberry Silk Ribbons UK',
    template: '%s | One Silk Ribbon'
  },
  description: 'Handmade 100% mulberry silk ribbons for weddings, bouquets and gift wrapping. 30+ hand-dyed colourways, priced in GBP, tracked delivery to the UK and Europe.',
  keywords: [
    'silk ribbon UK', 'mulberry silk ribbon', 'hand-dyed silk ribbon', 'handmade silk ribbon',
    'wedding ribbon UK', 'bridal ribbon', 'florist ribbon supplies', 'hand frayed ribbon',
    'silk ribbon for bouquets', 'wedding stationery ribbon',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'One Silk Ribbon — Handmade Silk Ribbon UK',
    description: 'Handmade 100% mulberry silk ribbons for weddings, bouquets and gift wrapping. 30+ hand-dyed colourways, shipped to the UK and Europe.',
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
    description: 'Handmade 100% mulberry silk ribbons for weddings, bouquets and gift wrapping. 30+ hand-dyed colourways, shipped to the UK and Europe.',
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
            <ShellWrapper navbar={<Navbar />} cartDrawer={<CartDrawer />} footer={<Footer />} cookieBanner={<CookieBanner />}>
              {children}
            </ShellWrapper>
            <Suspense fallback={null}>
              <WelcomePopup />
            </Suspense>
          </AuthProvider>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
