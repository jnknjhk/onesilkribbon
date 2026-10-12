'use client'
// 每个站点的后台差异（品牌名、系列、首页图片位置、邮件模板、有哪些功能）都在站点自己的
// admin.config.js 里声明，通过这个 context 交给共用的后台页面。
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
