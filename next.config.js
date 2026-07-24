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
  async headers() {
    // 注意：这里没有加 Content-Security-Policy——站内大量页面用内联 <style> 标签和
    // dangerouslySetInnerHTML（JSON-LD）渲染，且没有 nonce 机制，贸然加严格 CSP
    // 会直接打坏全站样式和结构化数据；要上 CSP 需要先给这些内联内容接入 nonce，属于单独的改造。
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
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
