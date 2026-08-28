import './globals.css'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { site, COLLECTIONS } from '@/config/site'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { CartProvider } from '@/components/CartProvider'
import { CartDrawer } from '@/components/CartDrawer'
import CookieBanner from '@/components/CookieBanner'
import ShellWrapper from '@osr/core/components/ShellWrapper'
import { AuthProvider } from '@osr/core/lib/auth'

/* ── 字体 ──────────────────────────────────────────────────
   标题 Cormorant Garamond：比 Playfair 更轻、字怀更开，接近展览图录。
   正文 Inter：中性、当代，和冷灰蓝的点缀色是一路的。 */

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
})

// 站内多处用 --font-serif-alt 做引言、副文案。复用同一套 Cormorant，
// 只是换个变量名挂上去，避免为此多下载一套字体拖慢首屏。
const cormorantAlt = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif-alt',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
})

/* ── SEO ──────────────────────────────────────────────────
   域名、品牌名、邮箱一律从 config/site.js 读，不在这里写死，
   否则以后换域名要满仓库找字符串。 */

const TITLE = `${site.name} — Hand-Blown Glass Objects & Art Pieces`
// TODO(文案)：等业主确认工艺、产地、价位后重写描述与关键词
const DESCRIPTION =
  'Hand-blown glass objects and sculptural pieces, made one at a time and shipped across the UK and Europe.'

const organizationSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/images/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        email: site.email,
        contactType: 'customer service',
      },
      sameAs: [
        // TODO(文案)：换成真实社媒账号，没有的先删掉，留着空账号对 SEO 是负分
        `https://www.instagram.com/${site.domain.split('.')[0]}`,
        `https://www.pinterest.com/${site.domain.split('.')[0]}`,
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${site.url}/#website`,
      url: site.url,
      name: site.name,
      publisher: { '@id': `${site.url}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${site.url}/collections?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export const metadata = {
  title: { default: TITLE, template: `%s | ${site.name}` },
  description: DESCRIPTION,
  keywords: [
    'hand blown glass UK',
    'glass art object',
    'sculptural glass',
    'studio glass UK',
    'mouth blown glass',
    'collectible glass',
    // 系列名跟着 config 走，改系列时关键词自动同步
    ...COLLECTIONS.map(c => c.name.toLowerCase()),
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: site.url,
    siteName: site.name,
    locale: 'en_GB',
    type: 'website',
    // 全站兜底分享图。图还没做，路径先接好：
    // 放一张 1200x630 到 public/og-image.jpg 即可生效。
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(site.url),
}

export const viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" className={`${cormorant.variable} ${cormorantAlt.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <CartProvider>
          <AuthProvider>
            <ShellWrapper
              navbar={<Navbar />}
              cartDrawer={<CartDrawer />}
              footer={<Footer />}
              cookieBanner={<CookieBanner />}
            >
              {children}
            </ShellWrapper>
          </AuthProvider>
        </CartProvider>
      </body>
    </html>
  )
}
