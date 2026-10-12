import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  // 注意：tracesSampleRate 管的是"性能追踪"的采样，不是错误。错误事件
  // （captureException / captureMessage）始终全量上报，不受它影响。
  // 服务端以前因为没有 instrumentation.js 根本没初始化过，这里如果照抄 1.0，
  // 一启用就会给每个请求都发一条追踪，很快吃掉 Sentry 额度，所以只抽样 10%。
  tracesSampleRate: 0.1,
})
