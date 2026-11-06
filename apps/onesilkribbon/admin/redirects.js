// 后台菜单合并后，旧页面地址跳到新位置。next.config.js 引用这一份。
// （CommonJS：next.config.js 是用 require 加载的）
const ADMIN_REDIRECTS = [
  { source: '/admin/journal', destination: '/admin/content?tab=journal', permanent: false },
  { source: '/admin/images', destination: '/admin/content?tab=images', permanent: false },
  { source: '/admin/media', destination: '/admin/content?tab=media', permanent: false },
  { source: '/admin/subscribers', destination: '/admin/customers?tab=subscribers', permanent: false },
  { source: '/admin/email', destination: '/admin/marketing?tab=email', permanent: false },
  { source: '/admin/emails', destination: '/admin/marketing?tab=log', permanent: false },
  { source: '/admin/maintenance', destination: '/admin/settings?tab=maintenance', permanent: false },
]

module.exports = { ADMIN_REDIRECTS }
