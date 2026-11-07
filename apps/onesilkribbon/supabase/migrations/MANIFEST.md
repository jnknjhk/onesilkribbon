# 数据库迁移执行顺序

新环境：先执行 `supabase/schema.sql`，再按下面的顺序逐个执行迁移文件。
已有环境：只执行尚未执行过的迁移；执行前先备份数据库。

`inventory-coupons` 必须排在 `payment-reliability` 之后，文件名排序并不等于执行顺序。

| 顺序 | 文件 | 作用 |
|---|---|---|
| 1 | `2026-09-02-customer-summary.sql` | 客户汇总视图 |
| 2 | `2026-09-02-email-log.sql` | 邮件发送记录 |
| 3 | `2026-09-30-security-and-atomicity.sql` | 安全策略、库存/优惠券原子函数、注册建档触发器 |
| 4 | `2026-10-14-payment-reliability.sql` | 支付快照、收据、通知、结账/完成支付事务 |
| 5 | `2026-10-14-inventory-coupons.sql` | 库存预占、退款、欢迎券、PayPal 清理 |
| 6 | `2026-10-14-subscription-safety.sql` | 订阅验证邮件限流与发券 |
| 7 | `2026-10-16-audit-security.sql` | Stripe 创建尝试、RLS/权限收紧 |
| 8 | `2026-11-06-baseline-completion.sql` | 补 orders/products/product_skus 缺失列 |
| 9 | `2026-11-06-product-save-atomic.sql` | 商品保存/删除事务函数 |
| 10 | `2026-11-06-admin-performance-indexes.sql` | 后台查询索引 |
| 11 | `2026-11-06-pii-erasure-and-order-closing.sql` | 关闭未付款订单、支付证据 PII 脱敏 |
| 12 | `2026-11-07-customer-identity.sql` | 游客订单按已验证邮箱归户、统一客户消费口径 |
| 13 | `2026-11-07-payment-refunds.sql` | 记录 Stripe/PayPal 外部退款，满额退款同步订单状态 |

## 安全说明

- 所有迁移只新增表、列、索引、函数和策略，不删除历史订单/支付证据/客户记录。
- `2026-09-30-security-and-atomicity.sql` 需要 Supabase 的 `auth.users` 表与 `auth.jwt()` 函数（Supabase 自带）。
- 新环境的 `schema.sql` 已包含 `settings / coupons / user_profiles / journal_posts / site_images / subscribers / user_addresses` 等表，避免再出现“alter 一张不存在的表”。
- 已有环境执行 `2026-11-06-pii-erasure-and-order-closing.sql` 后，后台“删除客户”会先关闭未付款订单、脱敏支付证据，再删除账号；不会物理删除订单。
