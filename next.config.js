const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'onesilkribbon.com'] }
  },
}

module.exports = withSentryConfig(nextConfig, {
  org:     'onesilkribbon',
  project: 'onesilkribbon',
  silent:  true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger:  true,
})
