import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 只在生产环境开启，本地开发不上报
  enabled: process.env.NODE_ENV === 'production',

  // 采样率：1.0 = 100% 的错误都上报
  tracesSampleRate: 1.0,

  // 忽略一些常见的无害错误
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^Network Error/,
    /^Loading chunk/,
  ],
})
