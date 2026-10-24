// Initialize each runtime separately; never include the Node SDK in edge bundles.
import { captureRequestError } from '@sentry/nextjs'
export const onRequestError = captureRequestError
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
