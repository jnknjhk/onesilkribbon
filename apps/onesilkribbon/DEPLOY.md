# One Silk Ribbon — 部署指南

## 第一步：把代码上传到 GitHub

1. 去 [github.com](https://github.com) 注册/登录账号（免费）
2. 点击右上角 **"+"** → **"New repository"**
3. 填写：
   - Repository name: `onesilkribbon`
   - 选 **Private**（私有，别人看不到你的代码）
   - 点击 **"Create repository"**
4. 打开你电脑上的终端（Mac: Command+Space 搜索"Terminal"）
5. 复制粘贴以下命令（逐行执行）：

```bash
cd ~/Desktop
# 把 onesilkribbon 文件夹拖到这里
cd onesilkribbon

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/onesilkribbon.git
git push -u origin main
```

---

## 第二步：连接 Vercel 部署

1. 登录 [vercel.com](https://vercel.com)
2. 点击 **"Add New Project"**
3. 选择 **"Import Git Repository"** → 选择 `onesilkribbon`
4. Framework Preset 选 **Next.js**（会自动识别）
5. 点击 **"Environment Variables"**，按下方填入所有变量
6. 点击 **"Deploy"**
7. 约 2 分钟后网站上线 ✅

---

## 第三步：填入环境变量

在 Vercel 的 Environment Variables 里逐个添加：

### Supabase（在 Supabase 后台 Settings > API 找）
```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_KEY          = eyJhbGc...
```

### Stripe（在 stripe.com/dashboard → Developers → API keys）
```
STRIPE_SECRET_KEY     = sk_live_...
STRIPE_WEBHOOK_SECRET = whsec_...（下一步配置）
```

> 结账走 Stripe Checkout 整页跳转，不需要 publishable key / Stripe Elements。

### 邮件（在 resend.com → API Keys / Domains）
```
RESEND_API_KEY = re_...
EMAIL_FROM     = song@onesilkribbon.com
```

> 没有 `RESEND_API_KEY` 时所有邮件发送都会报错；订单确认、发货通知、订阅验证都会受影响。

### PayPal（在 developer.paypal.com → My Apps）
```
NEXT_PUBLIC_PAYPAL_CLIENT_ID = AaBbCc...
PAYPAL_SECRET                = secret...
PAYPAL_MODE                  = live
PAYPAL_WEBHOOK_ID            = webhook-id（下一步创建）
```

### AfterShip（在 aftership.com → API）
```
AFTERSHIP_API_KEY = asat_...
```

### 后台与站点
```
NEXT_PUBLIC_SITE_URL = https://onesilkribbon.com
ADMIN_EMAILS         = song@onesilkribbon.com
```

> `ADMIN_EMAILS` 是逗号分隔的管理员邮箱。**没有它没人能登录 /admin。**
> 它还必须与 `supabase/schema.sql` 里 `is_admin_user()` 的邮箱保持一致。

### 退订链接签名
```
UNSUBSCRIBE_SECRET = 一串足够长的随机字符
```

> 用于给营销邮件生成不可伪造的退订链接。留空时回退到 `SUPABASE_SERVICE_KEY`；
> 建议单独配置，轮换密钥不会影响订单数据。可用 `openssl rand -hex 32` 生成。

### Sentry（错误监控，可选但强烈建议）
```
NEXT_PUBLIC_SENTRY_DSN =
SENTRY_ORG             = onesilkribbon
SENTRY_PROJECT         = onesilkribbon
SENTRY_AUTH_TOKEN      = sntrys_...（可选，用于上传 source map）
```

> 不配置 DSN 时 Sentry 静默不生效；没有 `SENTRY_AUTH_TOKEN` 时 source map 不会上传，
> 线上堆栈会是压缩后的。

---

## 第四步：配置 Stripe Webhook

1. 登录 Stripe → Developers → Webhooks
2. 点击 **"Add endpoint"**
3. URL 填入：`https://onesilkribbon.com/api/stripe/webhook`
4. 选择事件：
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `refund.created`
   - `refund.updated`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
5. 点击 **"Add endpoint"**
6. 复制 **Signing secret**（whsec_...）
7. 填入 Vercel 的 `STRIPE_WEBHOOK_SECRET`

> `payment_intent.payment_failed` 可以保留，但代码只把它当信息事件；真正释放库存的信号是 `checkout.session.expired` 或 `async_payment_failed`。

---

## 第四步之二：配置 PayPal Webhook

1. 登录 [developer.paypal.com](https://developer.paypal.com) → 你的 App → **Webhooks**
2. 添加 Webhook，URL 填入：`https://onesilkribbon.com/api/paypal/webhook`
3. 选择事件：
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.DECLINED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
   - `CUSTOMER.DISPUTE.CREATED`
   - `CUSTOMER.DISPUTE.UPDATED`
   - `CUSTOMER.DISPUTE.RESOLVED`
4. 创建后复制 **Webhook ID**，填入 Vercel 的 `PAYPAL_WEBHOOK_ID`

> 争议事件会写进 `payment_disputes`，并在后台「设置 → 支付恢复」和订单详情里提示。
> 订单状态不会自动改变，需要到支付平台提交证据。

---

## 第五步：初始化数据库

**新环境**按顺序执行：

1. 登录 [supabase.com](https://supabase.com)，进入项目 → **SQL Editor**
2. 新建查询，执行 `supabase/schema.sql`（可重复执行，只建表/列/索引/策略，不改数据）
3. 按 `supabase/migrations/MANIFEST.md` 里的顺序，逐个执行**全部**迁移文件
   - 注意：`2026-10-14-inventory-coupons.sql` 必须排在 `2026-10-14-payment-reliability.sql` 之后，不能按文件名排序
   - 不要只执行到某一天为止；`MANIFEST.md` 的最后一行就是当前最新迁移

**已有环境**：

- 先备份数据库；
- 只执行尚未执行过的迁移（顺序同上）；
- 不要重复执行已经跑过的迁移来“重建”数据库。

数据库结构变更记录都在 `supabase/migrations/`，不再只依赖 `schema.sql`。

---

## 第五步之二：部署门禁与备份恢复

### 部署门禁

- 合并到 `master` 前，GitHub Actions 的「Lint / 单元测试 / 依赖审计」和「构建」必须全绿。
- CI 的构建步骤不再静默跳过：缺少 Supabase 密钥会直接失败，避免生产构建长期没人验证。
- Vercel 由 Git 集成自动部署 `master`；不要在 CI 红的时候合并。
- 建议在 GitHub 仓库 **Settings → Branches** 给 `master` 加保护，要求 CI 通过后才能合并。

### 备份

在 `apps/onesilkribbon` 下：

```bash
npm run backup -- --dry-run                 # 只统计行数
npm run backup -- --include-storage         # 导出全部表 + media 图片
```

备份目录含客户个人信息，只能放在本机加密盘，`backups/` 已在 `.gitignore` 中忽略。

### 恢复

```bash
npm run restore -- --dir backups/<时间戳>                    # dry-run，只校验
npm run restore -- --dir backups/<时间戳> --apply --yes      # 真正写入
npm run restore -- --dir backups/<时间戳> --apply --yes --include-storage
```

- 恢复是 **upsert**，不会删除备份里没有的行；建议恢复到空环境。
- 目标库有任何非空表时默认拒绝；`--force` 会先检查自然键冲突，冲突时不会写入任何数据。
- JSON 备份不含 `auth.users` 登录账号；恢复后客户需要重新登录或重置密码。整库恢复请用 Supabase PITR。
- 恢复完请抽查：订单、商品/SKU、退款记录、支付争议、媒体图片。

---

## 第六步：把域名指向 Vercel

1. 在 Vercel → 你的项目 → **Settings → Domains**
2. 填入 `onesilkribbon.com`
3. Vercel 会给你两个 DNS 记录
4. 登录你的域名管理后台（买域名的地方）
5. 把旧的 Shopify DNS 删除，添加 Vercel 给你的新记录
6. 等待 24-48 小时生效

---

## 完成！🎉

网站上线后，你可以：
- 访问 `/admin` 进入管理后台（第二阶段开发）
- 在 Stripe 后台查看订单和收款
- 在 Supabase 后台查看数据库

如需修改任何内容，把对应文件发给 Claude，告诉他你想改什么即可。
