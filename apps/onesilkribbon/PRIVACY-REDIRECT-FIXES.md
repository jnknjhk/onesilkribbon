# Login redirect and telemetry privacy fixes

No database migration is required. Changes apply only to the silk application and its local core package; the independent glass repository/vendor copy is not modified.

## Login targets

`safeNextPath` validates both the input and normalized result, rejects protocol-relative/dot-segment bypasses, backslashes and controls, checks encoded path variants, and validates its fallback. Valid local query/hash values remain intact. All existing consumers use this shared guard.

## Confirmation credentials

Successful PayPal capture and Stripe confirmation now redirect to `/order-confirmed?order=...` without a proof or session bearer credential in the rendered page URL. The proof is stored in a per-order HttpOnly, SameSite=Lax cookie, Secure in production, scoped to `/api/order-status` and valid for at most 24 hours. It still grants only minimal order-confirmation status, not payment/refund authority or customer details.

Stripe first goes through a server confirmation endpoint that validates provider paid status, order binding, amount and currency before issuing the cookie. Existing proof/session confirmation links are exchanged server-side before rendering a page; legacy proof exchange preserves the original expiry. Status requests accept only the corresponding signed cookie, not URL credentials. Hashed checkout references preserve safe basket cleanup without sending the checkout-session ID back in status responses. Missing cookies or WebCrypto leave the basket intact.

Third-party payment callbacks necessarily still use provider-required URL parameters. These endpoints and private pages send `Referrer-Policy: no-referrer`; confirmation/tracking responses are no-store. Old URLs may already be present in browser history or infrastructure logs; this change does not retroactively erase records.

## Tracking and analytics

The tracking form posts order/email in JSON instead of URL query parameters. The old GET lookup returns 405. The same order/email check and masked response remain; responses are no-store. Sentry's server/edge request collection excludes bodies, cookies, headers, query strings and user data. Google Analytics is not initialized on private account/auth/checkout/confirmation/tracking pages, and an already-loaded tag is disabled on those routes.

## Telemetry

Browser/server/edge install shared `beforeSend`, `beforeSendTransaction`, `beforeSendSpan` and `beforeBreadcrumb` hooks. They remove URL queries/fragments/userinfo, request bodies/cookies, private headers/user data, sensitive nested fields and common labeled secrets in exception/console text. Cloning is bounded and cycle-safe; unknown/exotic data fails closed, while stack locations remain useful. Browser tracing samples 10%; this setting is not an error-event sampling rate. No session replay/profiling integration is added.

This protects new telemetry payloads; it neither reads nor deletes existing Sentry events. Arbitrary unlabeled personal information or sensitive values embedded in URL paths cannot be guaranteed scrubbed. Project access permissions and historical retention should be reviewed separately. A public Sentry DSN permits event submission, not event reads.

Verification uses mocked mail/provider/telemetry transports and a local production server. No real payments, orders or emails are created. Legacy-cookie smoke tests use a nonexistent order and print no signed credentials.
