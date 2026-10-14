export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Utility pages must be crawlable so engines can read their noindex tags.
        disallow: ['/api/'],
      },
    ],
    sitemap: 'https://onesilkribbon.com/sitemap.xml',
  }
}
