export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin-login', '/api/', '/account/', '/checkout', '/order-confirmed'],
      },
    ],
    sitemap: 'https://onesilkribbon.com/sitemap.xml',
  }
}
