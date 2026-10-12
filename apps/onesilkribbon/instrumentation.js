// Next.js 14 在服务端/边缘运行时启动时调用 register()。
//
// @sentry/nextjs v8 只会从这里初始化服务端和边缘端的 SDK——单独放着的
// sentry.server.config.js / sentry.edge.config.js 不会被自动加载。之前没有这个文件，
// 服务端的 Sentry 从来没有初始化过：API 里所有 Sentry.captureMessage / captureException
// （比如"钱已到账但订单没落库，需人工核对"）都是空操作，一条也没发出去。
// instrumentationHook 实验开关由 withSentryConfig 自动打开（Next 14 需要）。
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
