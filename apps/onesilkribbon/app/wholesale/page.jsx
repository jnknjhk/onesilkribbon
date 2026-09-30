import { permanentRedirect } from 'next/navigation'

// Bespoke 和 Wholesale 合并成了一页，/wholesale 保留下来只为接住已有的外部链接和收藏。
// 用 permanentRedirect（308）而不是 redirect（307）：307 是"临时"跳转，等于告诉 Google
// "原地址还会回来，别转移权重"，于是 /wholesale 会长期挂在"网页会自动重定向"里不消失。
export default function Wholesale() {
  permanentRedirect('/bespoke')
}
