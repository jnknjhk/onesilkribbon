'use client'
// 营销：优惠码、给顾客发邮件、邮件记录。三个页签各自在独立文件里。
import { useUrlState } from '../../lib/url-state'
import { PageHeader, Tabs } from '../../ui'
import CouponsTab from './CouponsTab'
import ComposeTab from './ComposeTab'
import EmailLogTab from './EmailLogTab'

const DEFAULTS = { tab: 'coupons', q: '', kind: '', status: '', page: '1', order: '', to: '', name: '' }
const TABS = [
  { key: 'coupons', label: '优惠码' },
  { key: 'email', label: '发邮件' },
  { key: 'log', label: '邮件记录' },
]

export default function MarketingPage() {
  const [get, set] = useUrlState(DEFAULTS)
  const tab = TABS.some(t => t.key === get('tab')) ? get('tab') : 'coupons'
  return (
    <div>
      <PageHeader title="营销" />
      <Tabs value={tab} onChange={v => set({ tab: v, q: '', kind: '', status: '', page: 1, order: '', to: '', name: '' })} tabs={TABS} />
      {tab === 'coupons' && <CouponsTab get={get} set={set} />}
      {tab === 'email' && <ComposeTab get={get} set={set} />}
      {tab === 'log' && <EmailLogTab get={get} set={set} />}
    </div>
  )
}
