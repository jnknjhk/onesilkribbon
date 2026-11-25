// This project's legacy DSN points at the EU ingest host, which rejects its project ID.
// Keep the key and project intact, and leave DSNs for other projects untouched.
export function resolveSentryDsn(dsn) {
  return dsn?.replace(
    /^(https:\/\/[a-f0-9]{32}@)o4511030004613120\.ingest\.de\.sentry\.io(\/4511030021259344\/?)$/i,
    '$1o4511030004613120.ingest.us.sentry.io$2',
  )
}
