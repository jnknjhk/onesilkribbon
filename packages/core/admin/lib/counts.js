'use client'
// 侧边栏"订单"上的待发货数字。以前每切换一次页面就重新查一遍（6 个计数查询），
// 现在由外框定时 / 回到窗口时刷新；订单列表、工作台本来就拿到了这个数，顺手告诉外框；
// 发货、退款、取消之后通知外框重新查。
const EVENT = 'osr-admin-counts'

export function publishToShip(n) {
  if (typeof window !== 'undefined' && Number.isFinite(n)) window.dispatchEvent(new CustomEvent(EVENT, { detail: { toShip: n } }))
}

export function refreshCounts() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: { refresh: true } }))
}

export const COUNTS_EVENT = EVENT
