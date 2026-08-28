'use client'

/**
 * 页脚。
 *
 * 结构按玻璃艺术品站的实际需要重排：系列 / 工作室 / 客户服务 三栏，
 * 加一个订阅框。不再有丝带站的 Journal、Wholesale 入口。
 *
 * 移动端把三栏折叠成手风琴——链接一多，平铺会让页脚长得离谱。
 */

import { useState } from 'react'
import Link from 'next/link'
import { site, COLLECTIONS } from '@/config/site'
import { isValidEmail, subscribeEmail } from '@osr/core/lib/client/subscribe'

const COLUMNS = [
  {
    title: 'Collections',
    links: [
      ...COLLECTIONS.map(c => ({ label: c.name, href: `/collections/${c.slug}` })),
      { label: 'All Collections', href: '/collections' },
    ],
  },
  {
    title: 'Studio',
    links: [
      { label: 'About',       href: '/about' },
      { label: 'Commissions', href: '/bespoke' },
      { label: 'Care',        href: '/care-guide' },
      { label: 'Contact',     href: '/contact' },
    ],
  },
  {
    title: 'Service',
    links: [
      { label: 'Shipping & Returns', href: '/shipping-returns' },
      { label: 'Track Order',        href: '/track-order' },
      { label: 'FAQ',                href: '/faq' },
      { label: 'Terms',              href: '/terms' },
      { label: 'Privacy',            href: '/privacy' },
    ],
  },
]

export function Footer() {
  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState('idle')   // idle | sending | done | error
  const [message, setMessage] = useState('')
  const [openCol, setOpenCol] = useState(null)   // 移动端手风琴展开的列

  async function onSubscribe(e) {
    e.preventDefault()
    const value = email.trim()
    if (!isValidEmail(value)) {
      setStatus('error')
      setMessage('Please enter a valid email address.')
      return
    }
    setStatus('sending')
    setMessage('')
    try {
      await subscribeEmail(value, 'footer')
      setStatus('done')
      setMessage('Thank you — you are on the list.')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setMessage(err?.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <footer className="foot">
      <div className="foot-top">
        <div className="foot-brand">
          <p className="foot-wordmark">One <em>Glass</em> Object</p>
          {/* TODO(文案)：等业主确认工艺与产地后重写这句 */}
          <p className="foot-tagline">{site.tagline}</p>

          <form className="foot-sub" onSubmit={onSubscribe}>
            <label className="foot-sub-label" htmlFor="foot-email">
              New work, once in a while
            </label>
            <div className="foot-sub-row">
              <input
                id="foot-email"
                className="foot-sub-input"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (status !== 'idle') { setStatus('idle'); setMessage('') } }}
                placeholder="Email address"
                autoComplete="email"
              />
              <button className="foot-sub-btn" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? '…' : 'Join'}
              </button>
            </div>
            {message && (
              <p className={`foot-sub-msg ${status === 'error' ? 'foot-sub-msg--err' : ''}`} role="status">
                {message}
              </p>
            )}
          </form>
        </div>

        <div className="foot-cols">
          {COLUMNS.map(col => {
            const open = openCol === col.title
            return (
              <div className="foot-col" key={col.title}>
                <button
                  className="foot-col-head"
                  aria-expanded={open}
                  onClick={() => setOpenCol(open ? null : col.title)}
                >
                  {col.title}
                  <span className={`foot-chev ${open ? 'foot-chev--open' : ''}`} aria-hidden="true" />
                </button>
                <ul className={`foot-col-list ${open ? 'foot-col-list--open' : ''}`}>
                  {col.links.map(l => (
                    <li key={l.href}><Link href={l.href} className="foot-link">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      <div className="foot-bottom">
        <p>© {new Date().getFullYear()} {site.name}</p>
        <p><a href={`mailto:${site.email}`} className="foot-link">{site.email}</a></p>
      </div>

      <style jsx>{`
        .foot {
          background: var(--paper-sunk);
          border-top: 1px solid var(--line);
          padding: var(--section-padding-y) 0 0;
        }
        .foot-top {
          max-width: 1360px; margin: 0 auto;
          padding: 0 var(--page-padding);
          display: grid; grid-template-columns: 1fr; gap: 48px;
        }

        .foot-wordmark {
          font-family: var(--font-display);
          font-size: 24px; font-weight: 300; color: var(--ink);
        }
        .foot-wordmark em { font-style: italic; color: var(--accent-deep); }
        .foot-tagline {
          margin-top: 10px; max-width: 340px;
          font-size: 14px; line-height: 1.7; color: var(--ink-soft);
        }

        .foot-sub { margin-top: 32px; max-width: 380px; }
        .foot-sub-label {
          display: block; margin-bottom: 10px;
          font-size: 10px; letter-spacing: 0.22em;
          text-transform: uppercase; color: var(--accent);
        }
        .foot-sub-row {
          display: flex; align-items: stretch;
          border-bottom: 1px solid var(--line-strong);
          transition: border-color var(--transition);
        }
        .foot-sub-row:focus-within { border-bottom-color: var(--accent); }
        .foot-sub-input {
          flex: 1; min-height: 44px;
          background: none; border: none; outline: none;
          font-family: var(--font-body); font-size: 16px; color: var(--ink);
        }
        .foot-sub-input::placeholder { color: var(--ink-faint); }
        .foot-sub-btn {
          background: none; border: none;
          padding: 0 4px 0 16px;
          font-family: var(--font-body); font-size: 10px;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--ink); transition: color var(--transition);
        }
        .foot-sub-btn:hover:not(:disabled) { color: var(--accent-deep); }
        .foot-sub-btn:disabled { color: var(--ink-faint); cursor: default; }
        .foot-sub-msg { margin-top: 10px; font-size: 12px; color: var(--ink-soft); }
        .foot-sub-msg--err { color: var(--danger); }

        .foot-cols { display: grid; grid-template-columns: 1fr; }
        .foot-col { border-top: 1px solid var(--line); }
        .foot-col-head {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; min-height: 52px; padding: 0;
          background: none; border: none;
          font-family: var(--font-body); font-size: 11px;
          letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink);
        }
        .foot-chev {
          width: 9px; height: 9px; margin-right: 2px;
          border-right: 1px solid var(--ink-soft);
          border-bottom: 1px solid var(--ink-soft);
          transform: rotate(45deg); transform-origin: center;
          transition: transform var(--transition);
        }
        .foot-chev--open { transform: rotate(225deg); }

        .foot-col-list {
          list-style: none; margin: 0; padding: 0;
          max-height: 0; overflow: hidden;
          transition: max-height 0.4s ease;
        }
        .foot-col-list--open { max-height: 420px; padding-bottom: 16px; }

        .foot-link {
          display: inline-block; padding: 7px 0;
          font-size: 13px; color: var(--ink-soft);
          transition: color var(--transition);
        }
        .foot-link:hover { color: var(--accent-deep); }

        .foot-bottom {
          max-width: 1360px; margin: 56px auto 0;
          padding: 20px var(--page-padding);
          border-top: 1px solid var(--line);
          display: flex; flex-direction: column; gap: 6px;
          font-size: 12px; color: var(--ink-faint);
        }

        @media (min-width: 768px) {
          .foot-top { grid-template-columns: 1.1fr 2fr; gap: 64px; }
          .foot-cols { grid-template-columns: repeat(3, 1fr); gap: 32px; }

          /* 桌面端不折叠：标题只是标题，列表常开 */
          .foot-col { border-top: none; }
          .foot-col-head { min-height: 0; margin-bottom: 14px; cursor: default; pointer-events: none; }
          .foot-chev { display: none; }
          .foot-col-list { max-height: none; padding-bottom: 0; }

          .foot-bottom { flex-direction: row; justify-content: space-between; align-items: center; }
        }
      `}</style>
    </footer>
  )
}
