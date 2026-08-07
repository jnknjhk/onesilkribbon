import * as Sentry from '@sentry/nextjs'

// 统一的 API 错误响应：真实错误只记日志/Sentry，绝不把数据库/第三方服务的原始错误信息
// （可能带表名、字段名、约束名等内部细节）透传给客户端。
export function errorResponse(err, { status = 500, message = 'Something went wrong. Please try again.', tag } = {}) {
  console.error(tag ? `[${tag}]` : 'API error:', err)
  try {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err?.message || err)), tag ? { tags: { api: tag } } : undefined)
  } catch {}
  return Response.json({ error: message }, { status })
}
