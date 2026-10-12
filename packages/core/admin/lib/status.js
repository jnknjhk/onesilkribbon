// 订单状态的名称、颜色和分组只在这里定义一次，前端页面和后台接口共用。
// 之前每个页面各写一份，"pending"在总览叫"待处理"、订单页也叫"待处理"，
// 实际意思却是"顾客还没付款"，很容易被当成要处理的订单。

export const ORDER_STATUS = {
  pending:   { label: '待付款', tone: 'neutral', hint: '顾客打开了付款页但还没付款' },
  paid:      { label: '待发货', tone: 'warning', hint: '已付款，等你发货' },
  shipped:   { label: '已发货', tone: 'info' },
  delivered: { label: '已送达', tone: 'success' },
  cancelled: { label: '已取消', tone: 'neutral' },
  refunded:  { label: '已退款', tone: 'danger' },
}

export function statusLabel(status) {
  return ORDER_STATUS[status]?.label || status || '—'
}

// 订单列表的页签。默认打开"待发货"——那是每天真正要处理的
export const ORDER_TABS = [
  { key: 'to_ship',    label: '待发货', statuses: ['paid'] },
  { key: 'shipped',    label: '已发货', statuses: ['shipped'] },
  { key: 'done',       label: '已完成', statuses: ['delivered'] },
  { key: 'unpaid',     label: '未付款', statuses: ['pending'] },
  { key: 'after_sale', label: '售后',   statuses: ['cancelled', 'refunded'] },
  { key: 'all',        label: '全部',   statuses: null },
]
export const DEFAULT_ORDER_TAB = 'to_ship'

export function tabStatuses(tabKey) {
  return ORDER_TABS.find(t => t.key === tabKey)?.statuses ?? null
}

// 计入销售额的状态
export const REVENUE_STATUSES = ['paid', 'shipped', 'delivered']

// 每种状态下能做的操作——详情页的按钮和后台接口的校验用同一份规则
export const CAN = {
  ship:    s => s === 'paid' || s === 'shipped',   // shipped 时是"修改快递信息"
  deliver: s => s === 'shipped',
  refund:  s => s === 'paid' || s === 'shipped' || s === 'delivered',
  cancel:  s => s === 'pending',                    // 已付款的订单走退款，不能直接"取消"
  resend:  s => s !== 'pending',
}
