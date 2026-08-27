import './globals.css'
import { Suspense } from 'react'
import { Playfair_Display, Lora, Jost } from 'next/font/google'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/components/CartProvider'
import { CartDrawer } from '@/components/CartDrawer'
import ShellWrapper from '@osr/core/components/ShellWrapper'
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
      '@id': 'https://oneglassobject.com/#organization',
      name: 'One Glass Object',
      url: 'https://oneglassobject.com',
      logo: 'https://oneglassobject.com/images/logo.png',
      contactPoint: { '@type': 'ContactPoint', email: 'hello@oneglassobject.com', contactType: 'customer service' },
      sameAs: ['https://www.instagram.com/oneglassobject', 'https://www.pinterest.com/oneglassobject'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://oneglassobject.com/#website',
      url: 'https://oneglassobject.com',
      name: 'One Glass Object',
      publisher: { '@id': 'https://oneglassobject.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://oneglassobject.com/collections?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export const metadata = {
  title: {
    default: 'One Glass Object — Hand-Blown Glass Objects UK',
    template: '%s | One Glass Object'
  },
  description: 'Hand-blown glass objects for everyday rituals — drinking glasses, vases, bowls and lighting, made by hand in the UK and shipped across the UK and Europe.',
  keywords: [
    'hand blown glass UK', 'handmade drinking glasses', 'glass vase UK', 'artisan glassware',
    'hand blown vase', 'handmade glass bowl', 'glass lighting UK', 'mouth blown glass',
    'handmade tableware UK', 'studio glass',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'One Glass Object — Hand-Blown Glass Objects UK',
    description: 'Hand-blown glass objects for everyday rituals — made by hand in the UK.',
    url: 'https://oneglassobject.com',
    siteName: 'One Glass Object',
    locale: 'en_GB',
    type: 'website',
    // 全站兜底分享图——没有自己声明 openGraph 的页面（/about、/contact 等）都会用这张。
    // 图片文件本身还没放进去，路径先接好：把 1200x630 的品牌图放到 public/og-image.jpg 即可生效。
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'One Glass Object — Hand-Blown Glass Objects UK' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Glass Object — Hand-Blown Glass Objects UK',
    description: 'Hand-blown glass objects for everyday rituals — made by hand in the UK.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://oneglassobject.com'),
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
            </Suspense>
          </AuthProvider>
        </CartProvider>
      </body>
    </html>
  )
}
