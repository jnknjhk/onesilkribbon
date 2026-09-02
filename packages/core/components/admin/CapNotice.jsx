'use client'

// 后台列表接口都带一个"最多返回 N 条"的兜底上限，防止数据量增长后单次响应无限膨胀。
// 问题是触顶这件事是**静默**的：超出上限的老记录直接从后台消失，页面不报错，
// 搜索也搜不到，只有等到"某笔订单怎么查不到了"才会发现。
//
// 这个组件负责把触顶说出来，让"该上服务端分页了"这个时间点是被看见的。
export function CapNotice({ total, limit, noun = '记录' }) {
  if (!total || !limit || total <= limit) return null
  return (
    <div style={{
      padding: '10px 14px', marginBottom: 16, borderRadius: 6, fontSize: 12, lineHeight: 1.6,
      background: '#FFF7E8', border: '1px solid #E8C98A', color: '#8A6410',
    }}>
      ⚠ 当前仅显示最近 {limit} 条{noun}，实际共 <strong>{total}</strong> 条。
      更早的{noun}在后台看不到、也搜不到——该给这个页面上服务端分页了。
    </div>
  )
}
