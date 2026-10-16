import * as Sentry from '@sentry/nextjs'
import { telemetryPrivacyHooks } from './lib/telemetry-privacy'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  ...telemetryPrivacyHooks,
  integrations: [Sentry.requestDataIntegration({
    include: { data: false, cookies: false, query_string: false, user: false, ip: false, headers: false },
  })],

  // 边缘运行时里只有中间件。中间件对每个请求都会运行（为了清掉伪造的管理员身份头，
  // 见 packages/core/lib/admin-middleware.js），Sentry 又会自动给它包一层追踪——
  // 按 1.0 采样就是每个页面、图片、链接预取都多一条追踪，没什么可看的，白耗额度。
  // 关掉追踪不影响错误上报：中间件里抛出的异常照样会发到 Sentry。
  tracesSampleRate: 0,
})
