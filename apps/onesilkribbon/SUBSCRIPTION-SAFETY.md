# Subscription email safeguards

Apply `supabase/migrations/2026-10-14-subscription-safety.sql` to the **silk** Supabase project before deploying the API change. This is not the glass site's Lumina database. The migration is transactional, additive and repeatable; it does not delete or rewrite existing subscribers or coupons.

The database serializes admission across serverless instances: one accepted attempt per address per 60 seconds, at most three per address in a rolling 24 hours, and at most 100 total per rolling hour. Failed mail deliveries also consume admission budget. These conservative limits protect mail spending; a distributed flood can still exhaust the shared quota and temporarily deny legitimate subscriptions. No claim of bot elimination is made.

An unexpired verification token is reused without extending its lifetime. Failed/ambiguous sends reuse the same request UUID and Resend idempotency key for up to 23 hours. A successful resend uses a new request UUID but the same valid verification link. Missing database access fails closed: it never falls back to unlimited email sends. Existing verified subscribers return the same success shape without issuing another coupon.

Request rows contain addresses and verification tokens. Both new tables have RLS enabled and public privileges revoked; only the service role is granted access. Logs must not include addresses, tokens or provider error bodies. No raw IP addresses are collected. This migration deliberately does not implement a destructive retention job. Retention/privacy cleanup should be reviewed alongside the existing subscriber and welcome-claim records rather than deleting only one copy.

Verification: PGlite tests cover counters, token preservation, retries, rollback, reapplication and grants. Parallel test calls are queued by the single PGlite connection; this is not a production multi-connection load test. API tests mock database and mail delivery and send no real email.
