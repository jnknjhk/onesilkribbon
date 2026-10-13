'use client'
// 后台页面切换时、新页面还没准备好之前显示的骨架（app/admin/loading.jsx 用它）。
// 没有它，点了侧边栏之后旧页面会原样停在那里，看起来像没反应
import { Card, SkeletonRows, styles as s } from './ui'

export default function AdminLoading() {
  return (
    <div>
      <div className={s.pageHeader}><div className={s.skeleton} style={{ width: 160, height: 26 }} /></div>
      <Card><SkeletonRows rows={6} /></Card>
    </div>
  )
}
