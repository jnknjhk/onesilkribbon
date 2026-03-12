const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
    ],
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
