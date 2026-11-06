import AdminShell from '@/admin/shell/AdminShell'
import { siteConfig } from '@/admin/site-config'

// 后台的页面不让搜索引擎收录
export const metadata = {
  title: '店铺后台',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }) {
  return <AdminShell config={siteConfig}>{children}</AdminShell>
}
