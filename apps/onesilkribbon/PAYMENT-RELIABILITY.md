# 支付可靠性迁移

仅适用 One Silk Ribbon，不适用玻璃站 Lumina。

## 上线顺序

1. 在丝带站 Supabase 项目（ref: jmwautbooalixgvlfhnk）执行
   `supabase/migrations/2026-10-14-payment-reliability.sql`。
2. 确认执行成功，再部署本次代码。缺少函数时新结账会拒绝生成支付链接。
3. 检查 `/admin/payment-recovery`，并在测试支付环境验证下单及通知。

迁移新增恢复记录、付款凭证、邮件待发送记录及事务函数，不删除或重写历史订单。
新下单时订单主记录、商品明细和快照一起保存，才创建付款链接。
付款确认、库存扣减、优惠券计数及邮件任务写入在单个事务完成。
Stripe 出错返回 503，请平台重试；PayPal 先查支付状态，已收款不再次扣款。
PayPal 会话保留，不再成功后删除。维护清理不得删除被付款快照保护的订单和明细。

## 恢复

打开 `/admin/payment-recovery` 可查看未完成的凭证、通知和 PayPal 待核对订单。
核对按钮只读取 PayPal 状态，不会收取新的款项；真正未付款订单显示未完成属正常。
PayPal 客户未返回本站时，可在此手动核对；本轮未新增 PayPal webhook 或定时任务。
旧 Stripe 订单在回调重试时从已有明细接管。旧已付款订单没有事务快照时不重复扣库存，
其历史缺失数据需人工对账。旧订单已丢失的明细不能凭空还原。

本轮不修复库存预留、退款并发、优惠券限次等第二批问题。
邮件任务保留到成功发送；幂等键用于短期重试去重，不承诺邮件永远只发一次。
数据库故障期间支付证据可能仅存在支付平台，恢复后通过平台重试/核对补录。
备份与灾难恢复仍依赖 Supabase，不作“任何故障下绝不丢数据”的承诺。

## 本地验证

`node --test apps/onesilkribbon/tests/payment-reliability.test.cjs`
使用本地 PostgreSQL（PGlite），不访问线上库，不创建真实付款。
