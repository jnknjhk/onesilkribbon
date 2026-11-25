import { normalizeEmail, verifyUnsubscribeToken } from '@/lib/unsubscribe'

export const metadata = {
  title: 'Unsubscribe',
  description: 'Manage your One Silk Ribbon email preferences.',
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({ searchParams }) {
  const params = await searchParams
  const email = normalizeEmail(params?.email)
  const token = typeof params?.token === 'string' ? params.token : ''
  const done = params?.done === '1'
  const failed = params?.error === '1'
  const valid = !!email && verifyUnsubscribeToken(email, token)

  return (
    <div style={{ paddingTop: 68, background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="policy-wrap">
        <h1>Email preferences</h1>

        {done && (
          <>
            <p>You have been unsubscribed from One Silk Ribbon marketing emails.</p>
            <p>You will still receive transactional emails about orders you place, such as order confirmations and shipping notifications.</p>
          </>
        )}

        {!done && failed && (
          <>
            <p>We could not complete the unsubscribe request. The link may be incomplete or out of date.</p>
            <p>Please use the unsubscribe link in the most recent marketing email, or contact us at <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a>.</p>
          </>
        )}

        {!done && !failed && !valid && (
          <>
            <p>This unsubscribe link is invalid or incomplete.</p>
            <p>Please use the link in the most recent marketing email, or contact us at <a href="mailto:song@onesilkribbon.com">song@onesilkribbon.com</a> and we will remove you manually.</p>
          </>
        )}

        {!done && !failed && valid && (
          <>
            <p>Stop receiving marketing emails at <strong>{email}</strong>?</p>
            <p>You will still receive order confirmations, shipping notifications and replies to messages you send us.</p>
            <form action="/api/unsubscribe" method="post">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="policy-button">Unsubscribe me</button>
            </form>
          </>
        )}
      </div>
      <style>{`
        .policy-button {
          margin-top: 12px; background: #1C1714; color: #F7F3EE; border: 0; cursor: pointer;
          padding: 14px 32px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
        }
        .policy-button:hover { background: #3a2f28; }
      `}</style>
    </div>
  )
}
