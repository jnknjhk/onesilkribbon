'use client'
// 后台的品牌名、商品系列、首页图片位置和邮件模板在 admin/site-config.js 里声明，
// 通过这个 context 交给各页面使用。
import { createContext, useContext } from 'react'

const AdminConfigCtx = createContext(null)

export function AdminConfigProvider({ config, children }) {
  return <AdminConfigCtx.Provider value={config}>{children}</AdminConfigCtx.Provider>
}

export function useAdminConfig() {
  const cfg = useContext(AdminConfigCtx)
  if (!cfg) throw new Error('useAdminConfig 必须在 AdminConfigProvider 里使用')
  return cfg
}

export function collectionLabel(cfg, value) {
  return cfg.collections.find(c => c.value === value)?.label || value || '—'
}
