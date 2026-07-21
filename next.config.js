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
  async redirects() {
    return [
      // 没有商品目录列表页（导航逻辑是 首页 → 系列 → 商品），/products 本身只是
      // /products/[slug] 这个路由结构带出的一个天然但不存在的父路径，与其让它 404，
      // 不如直接 301 到系列页，接回"首页/系列/商品"这条预期的浏览路径
      { source: '/products', destination: '/collections', permanent: true },
    ]
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
