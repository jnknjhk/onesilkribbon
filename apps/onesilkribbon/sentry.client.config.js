import * as Sentry from '@sentry/nextjs'
import { telemetryPrivacyHooks } from './lib/telemetry-privacy'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 只在生产环境开启，本地开发不上报
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  ...telemetryPrivacyHooks,

  // 性能追踪只抽样 10%；tracesSampleRate 不控制错误事件的采样。
  tracesSampleRate: 0.1,

  // 忽略一些常见的无害错误
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^Network Error/,
    /^Loading chunk/,
  ],
})
