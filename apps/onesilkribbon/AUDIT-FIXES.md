# 2026-10-16 audit fixes

Apply `supabase/migrations/2026-10-16-audit-security.sql` to the **silk** Supabase database before deploying these changes. Do not run it against the independent glass site's Lumina database.

## Data preservation and permissions

The migration does not delete or rewrite orders, order items, subscribers, coupons, payment evidence or stock. It enables RLS and removes all historical policies on `orders`, `order_items` and the legacy `newsletter_subscribers` table, then revokes PUBLIC/anonymous/authenticated table access. Application APIs already authenticate and use the service role. Service-role access remains explicitly granted. The repeatable migration also creates a protected Stripe-attempt table. Historical subtotal values are not silently rewritten; old records can be audited separately against their original line items and payment evidence.

## Checkout failure and recovery

Contact/delivery data is validated before reservation. New Stripe reservations and their exact 45-minute deadline/key scope are saved in one database transaction. Provider-start marking is serialized against cancellation, before the network request; a known returned session ID is saved before exposing its URL. Definitive provider rejections/local pre-call failures release reservations. Known sessions must be confirmed expired and unpaid before releasing. Timeout, 5xx, provider lookup failure and incomplete/truncated session listings never count as failed payment.

New actual checkout attempts run only bounded local database cleanup for never-started Stripe preparations and the existing PayPal expiry guard. They never wait on old Stripe provider lookups. Signed expiry webhooks and Settings → payment recovery handle provider-started attempts, including older orders. This is not a scheduled/background cleanup guarantee. An unbound started attempt can be released only under its original key scope, after its saved creation deadline plus two minutes and a successful complete provider listing over its possible creation window. A rotated key/account scope or old unbound order without a saved deadline requires manual investigation. Already-paid provider sessions are recorded/finalized without initiating another payment. Multiple matching sessions require manual investigation. Cancellation uses the same provider checks even if local session binding is missing.

## Other fixes

- Email HTML escapes customer/product/order/tracking text; tracking links require HTTPS with no URL credentials.
- Shared JSON-LD serializer escapes script terminators and Unicode line separators without modifying stored content.
- Server pricing keeps the gross merchandise subtotal and computes shipping/total after discounts. Decimal and percentage rounding uses exact integer/BigInt arithmetic matching PostgreSQL numeric for currency values. PayPal uses the authoritative subtotal as well.
- Coupon preview is read-only and prices the real SKU cart from the database. Malformed/invalid/exhausted/expired/minimum-failing codes return the same generic error; private coupon descriptions and thresholds are not returned. Preview is not a reservation; final checkout still validates coupon availability transactionally.
- Search uses separate parameterized column filters, literal wildcard handling, a bounded query length, deduplication and an eight-result public-field allowlist. It does not interpolate input into PostgREST logical-filter syntax.

Tests use mocked provider/mail calls and a local PGlite fixture; they create no production orders or emails. PGlite serializes queries on one connection and is not a production concurrency load test. Safe read-only production checks should verify denied anonymous access and table presence after applying SQL. No dependency upgrade or claim of resolving every possible website vulnerability is included.
