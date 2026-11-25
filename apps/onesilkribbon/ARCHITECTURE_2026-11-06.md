# One Silk Ribbon 网站架构说明

日期：2026-11-06
目的：用店主能理解的方式，讲清楚这个网站由哪些部分组成、顾客下单时发生了什么、后台怎么管店。
说明：只做架构梳理，不列问题、不改代码。

> 更新（2026-11-25）：缓存、测试数量、媒体关系、邮件能力已按当前代码修正；
> 新增支付争议、营销退订、备份恢复的说明。当前状态与待办见 `SITE_MAP_2026-11-25.md`。

---

## 一、先看全貌：网站由 6 个部分组成

把网站想成一家店：

| 店铺里的角色 | 对应系统 | 作用 |
|---|---|---|
| 门面与货架 | Next.js（部署在 Vercel） | 顾客看到的首页、系列页、商品页、文章页 |
| 仓库与账本 | Supabase（Postgres 数据库） | 存商品、库存、订单、客户、文章、设置 |
| 收银台 | Stripe + PayPal | 收信用卡和 PayPal 的钱 |
| 店员与办公室 | `/admin` 后台 | 上架商品、发货、退款、写文章、发优惠码 |
| 邮局 | Resend | 发订单确认、发货通知、订阅邮件、联系表单回复 |
| 物业与监控 | Vercel + Sentry + GA4 | 托管网站、记录报错、统计访问 |

另外两个辅助：

- **Supabase Storage**：存商品图、文章封面、首页轮播图（统一媒体库）。
- **AfterShip**（可选）：查快递轨迹；没配置时只显示订单自身状态。

---

## 二、顾客打开网页时，页面是怎么来的

### 不是静态 HTML，而是“按数据现做”

首页、系列页、商品页、文章页都是 Next.js 在服务器上查数据库后生成的。

```
顾客浏览器
   ↓ 请求 /collections/fine-silk-ribbons
Vercel 上的 Next.js
   ↓ 查 Supabase
products / product_skus / site_images / settings / journal_posts
   ↓
生成 HTML（含价格、库存、图片、结构化数据）
   ↓
返回给顾客
```

### 页面有缓存，不是每次访问都查库

| 页面 | 缓存时间 | 含义 |
|---|---|---|
| 首页、系列页、Journal 列表 | 约 60 秒 | 后台改完后，最多 1 分钟前台才更新 |
| 商品详情页 | 每次请求动态生成 | 页面要读可选 `?sku=` 参数，Next 会因此跳过 ISR；`revalidate` 不生效 |
| Journal 文章页 | 约 5 分钟 | 文章发布/修改时后台会主动刷新 |
| sitemap | 每次请求生成 | 保证新商品/文章立即出现 |
| Google 商品 feed | 约 60 秒 | 给 Google Shopping 用 |

这样做是为了让顾客打开页面更快，也减少数据库压力。

### 浏览器负责什么

- 购物车：存在顾客自己的浏览器里（localStorage），不登录也能加购。
- 图片切换、规格选择、弹窗、Cookie 同意横幅。
- 页面上的价格和库存只是“展示”；真正下单时服务器会重新算一遍。

### 商品、规格、库存的关系

一个商品（`products`）下面可以有多个规格（`product_skus`）：

```
商品：Fine Silk Ribbon
  ├─ SKU：2mm · Pearl White · 10m · £8.50 · 库存 12
  ├─ SKU：4mm · Pearl White · 10m · £12.00 · 库存 8
  └─ SKU：7mm · Burgundy · 10m · £16.00 · 库存 0
```

顾客选的其实是 **SKU**：价格、库存、图片都按 SKU 算。商品页网址里的 `?sku=...` 就是选中的规格。

---

## 三、顾客下单付款时，完整发生了什么

这是整个网站最核心的链路。以 Stripe 刷卡为例：

### 第 1 步：顾客在结账页填地址

结账页（`app/checkout/page.jsx`）收集邮箱、姓名、地址、电话，并让顾客选 Stripe 或 PayPal。

### 第 2 步：服务器重新算价

顾客点“Place Order”后，浏览器把购物车发给服务器。服务器**不相信浏览器传来的价格**，而是：

1. 按 SKU ID 重新查数据库里的真实价格；
2. 检查商品是否上架、SKU 是否启用、库存够不够；
3. 检查优惠码是否有效、有没有过期、有没有超过使用次数、有没有达到最低金额；
4. 从 `settings` 表读运费和免邮门槛，重新算总价。

这一步的代码在 `lib/order-pricing.js` 和 `lib/pricing.js`。

### 第 3 步：创建订单并“预占”库存

服务器先在数据库里创建一笔“待付款”订单，同时把库存**预占**掉。

预占的意思是：这件货先给你留着，但还没有真正扣掉。如果付款失败或超时，预占会释放回库存；如果付款成功，预占变成真正扣减。

这一步由数据库函数 `prepare_payment_checkout` 完成，订单、订单明细、支付快照、库存预占在**同一个事务**里提交——要么全部成功，要么全部不写。

### 第 4 步：跳转到支付平台

- 选 Stripe：服务器创建一个 Stripe Checkout 页面，顾客跳过去刷卡。
- 选 PayPal：服务器创建一个 PayPal 订单，顾客跳过去登录 PayPal 付款。

### 第 5 步：支付成功后，支付平台通知网站

- Stripe 通过 webhook 回调 `/api/stripe/webhook`。
- PayPal 在顾客付款后跳回 `/api/paypal/capture`。

网站会验证：这笔钱是不是对应这笔订单、金额对不对、币种是不是英镑。

### 第 6 步：数据库一次性完成“确认收款”

验证通过后，数据库函数 `complete_payment_checkout` 在同一个事务里做：

1. 记录一条支付收据（防止同一笔支付被重复处理）；
2. 真正扣减库存；
3. 优惠券使用次数 +1；
4. 订单状态改成“已付款”；
5. 准备好给顾客和店主的邮件内容。

### 第 7 步：发邮件

- 给顾客发“订单确认”；
- 给店主发“有新订单”。

邮件由 Resend 发送，发送记录写进 `email_log`，后台能看到成功/失败。

### 第 8 步：顾客看到订单确认页

顾客被带到 `/order-confirmed`，页面通过一个短期有效的确认凭证去查订单状态，不会把订单信息暴露在网址里。

### 第 9 步：后台看到“待发货”

店主打开 `/admin`，工作台会显示待发货数量；订单页默认打开“待发货”页签。

### 这条链路里三个重要设计

| 设计 | 用大白话解释 |
|---|---|
| 服务端权威计价 | 浏览器说多少钱不算数，服务器按数据库重新算 |
| 库存预占 | 先占住库存再付款，避免两个人同时买走最后一件 |
| 幂等 | 支付平台可能重复通知，网站只处理一次，不会重复扣库存/发邮件 |

---

## 四、后台是怎么搭的

### 登录与权限

1. 店主打开 `/admin-login`，用 Supabase 账号（邮箱 + 密码）登录。
2. 登录后访问 `/admin`，网站的“门卫”（`proxy.js` → `admin/middleware.js`）会检查：
   - 这个邮箱是否在管理员名单 `ADMIN_EMAILS` 里；
   - 不是管理员就退回登录页。
3. 后台接口 `/api/admin/*` 也有同样的检查，未登录直接返回 401。

管理员名单有两处：环境变量 `ADMIN_EMAILS` 和数据库里的 `is_admin_user()` 函数，两边要保持一致。

### 后台页面怎么工作

后台页面是“客户端应用”：页面先在浏览器加载，再用 fetch 调 `/api/admin/*` 拿数据。

```
/admin 页面（浏览器）
   ↓ fetch
/api/admin/products、/api/admin/orders ...
   ↓
admin/api/*.js（服务器）
   ↓
Supabase（service role，绕过 RLS）
```

后台接口用 service role，是因为后台需要读停用 SKU、客户地址、支付记录等，普通匿名权限读不到；权限由“管理员邮箱白名单”在接口层把关。

### 七个菜单分别管什么

| 菜单 | 主要用途 |
|---|---|
| 工作台 | 今天要发几单、哪些库存低、最近订单、销售额 |
| 订单 | 查订单、看明细、发货、退款、打印装箱单、导出 |
| 商品 | 新建/编辑商品、规格、价格、库存、图片、上下架、复制 |
| 客户 | 按邮箱看客户、订单、地址、订阅状态；删除客户（GDPR） |
| 内容 | 写 Journal 文章、设置网站各处图片、管理媒体库 |
| 营销 | 优惠码、给客户群发邮件、邮件发送记录、订阅者 |
| 设置 | 运费/免邮门槛、低库存阈值、支付恢复、数据维护 |

后台页面在 `admin/pages/`，后台接口在 `admin/api/`，`app/admin` 和 `app/api/admin` 只是把它们接到网址上。

---

## 五、数据库里存了什么

### 按店铺业务分类

| 业务 | 表 | 说明 |
|---|---|---|
| 商品 | `products` | 商品名、网址、描述、系列、上下架、首页精选 |
| | `product_skus` | 每个规格的颜色、宽度、长度、价格、库存、图片 |
| | `media` | 统一媒体库：图片地址、路径、分类 |
| 订单 | `orders` | 订单号、客户邮箱、金额、地址、状态、物流 |
| | `order_items` | 每笔订单买了什么、数量、单价 |
| | `tracking_events` | 物流轨迹（发货、送达、AfterShip 节点） |
| 支付 | `paypal_sessions` | PayPal 下单时的临时表单和明细 |
| | `payment_checkouts` | 结账快照（订单 + 明细），对账用 |
| | `payment_receipts` | 支付收据，防止重复处理 |
| | `payment_notifications` | 待发邮件的内容，发完打勾 |
| | `checkout_reservations` | 库存预占状态：active → capturing → consumed/released |
| | `refund_requests` | 退款申请与结果 |
| 客户 | `customers` | 旧客户表，订阅确认时写入 |
| | `user_profiles` | 登录账号的姓名、电话、头像 |
| | `user_addresses` | 账户里保存的收货地址 |
| | `subscribers` | 邮件订阅者与验证状态 |
| 内容 | `journal_posts` | Journal 文章 |
| | `site_images` | 首页轮播、系列图、About 图等“位置 → 图片” |
| 营销 | `coupons` | 优惠码、折扣、次数、有效期 |
| | `email_log` | 每封邮件的发送记录 |
| 设置 | `settings` | 运费、免邮门槛、低库存阈值等键值对 |

### 简单关系图

```
products 1 ─── N product_skus
media 是独立图片登记表，与 products 没有外键，靠 URL 字符串被引用
orders   1 ─── N order_items
orders   1 ─── 1 payment_checkouts
orders   1 ─── N payment_receipts
orders   1 ─── N tracking_events
orders   1 ─── 1 checkout_reservations
user_profiles 1 ─── N user_addresses
coupons  1 ─── N orders（通过折扣码关联）
```

### 为什么有“视图”和“数据库函数”

- **视图 `customer_summary`**：把订单按邮箱汇总成“客户列表”，后台客户页直接读它。
- **数据库函数**：把“建单 + 预占 + 扣库存 + 退款 + 发订阅券”这类多步操作打包成一个事务，避免做到一半失败留下脏数据。

---

## 六、代码地图：想改东西去哪里找

| 目录 | 作用 | 典型文件 |
|---|---|---|
| `app/` | 所有页面和 API 网址 | 商品页 `app/collections/[slug]/[productSlug]/page.jsx` |
| `app/api/` | 前台/支付/账户接口 | Stripe 下单 `app/api/stripe/create-checkout-session/route.js` |
| `app/admin/` | 后台页面入口 | `app/admin/orders/page.jsx` |
| `admin/` | 后台模块（页面、接口、组件） | 商品编辑器 `admin/pages/products/ProductEditor.jsx` |
| `components/` | 前台公共组件 | 导航 `components/Navbar.jsx`、购物车 `components/CartProvider.jsx` |
| `lib/` | 业务逻辑 | 计价 `lib/pricing.js`、订单计价 `lib/order-pricing.js`、邮件 `lib/email.js` |
| `packages/core/` | 跨模块共享 | Supabase 客户端 `packages/core/lib/supabase.js`、登录状态 `packages/core/lib/auth.js` |
| `supabase/` | 数据库结构和变更记录 | `supabase/schema.sql`、`supabase/migrations/*.sql` |
| `tests/` | 自动测试 | 支付、库存、SEO、隐私等 43 个测试文件、332 个测试（2026-11-25） |
| `e2e/` | 浏览器端冒烟测试 | `e2e/admin-smoke.spec.js` |

### 几个最常看的文件

| 想理解/修改 | 先看 |
|---|---|
| 商品页怎么显示 | `app/collections/[slug]/[productSlug]/page.jsx` |
| 结账表单怎么校验 | `app/checkout/page.jsx`、`lib/checkout-form.js` |
| 价格/运费怎么算 | `lib/pricing.js`、`lib/order-pricing.js` |
| Stripe 怎么下单 | `app/api/stripe/create-checkout-session/route.js` |
| 支付成功怎么扣库存 | `supabase/migrations/2026-10-14-payment-reliability.sql` |
| 后台商品怎么保存 | `admin/pages/products/ProductEditor.jsx`、`admin/api/products.js` |
| 后台鉴权 | `proxy.js`、`admin/middleware.js`、`admin/auth.js` |
| 数据库有哪些表/函数 | `supabase/schema.sql` + `supabase/migrations/` |

---

## 七、部署与外部服务

### 线上运行在哪里

```
GitHub 代码
   ↓ 自动部署
Vercel（运行 Next.js）
   ├─ 前台页面
   ├─ /api 接口
   └─ 定时/增量刷新缓存
   ↓
Supabase（数据库 + 登录 + 图片存储）
   ↓
Stripe / PayPal（收款）· Resend（邮件）· AfterShip（物流）· Sentry（报错）· GA4（统计）
```

### 需要配置的外部账号

| 服务 | 用途 | 关键环境变量 |
|---|---|---|
| Supabase | 数据库、登录、图片 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_KEY` |
| Stripe | 信用卡收款 | `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` |
| PayPal | PayPal 收款 | `NEXT_PUBLIC_PAYPAL_CLIENT_ID`、`PAYPAL_SECRET`、`PAYPAL_MODE` |
| Resend | 邮件 | `RESEND_API_KEY`、`EMAIL_FROM` |
| AfterShip | 物流轨迹（可选） | `AFTERSHIP_API_KEY` |
| Sentry | 报错监控（可选） | `NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT` |
| 站点 | 生成支付回跳/邮件链接 | `NEXT_PUBLIC_SITE_URL` |
| 后台 | 管理员邮箱 | `ADMIN_EMAILS` |

### 数据库怎么初始化

数据库结构不是一次写死的，而是由 `supabase/schema.sql` 加上 `supabase/migrations/` 里按日期排列的迁移文件组成。迁移文件记录每次结构变更（新增表、索引、函数、安全策略），部署新环境时要按顺序执行。

---

## 八、日常操作对应表

| 你想做的事 | 后台位置 | 影响 |
|---|---|---|
| 上架新商品、改价格、改库存 | 商品 → 新建/编辑 | 前台商品页、系列页、Google feed |
| 改首页轮播图、系列封面、About 图 | 内容 → 网站图片 | 首页、系列页、About 页 |
| 上传一张新图片 | 内容 → 媒体库 | 供商品/文章/网站图片选用 |
| 写一篇 Journal 文章 | 内容 → 文章 | Journal 列表和文章页 |
| 看订单、发货、填快递单号 | 订单 → 待发货 | 订单状态、发货邮件、物流轨迹 |
| 退款 | 订单详情 → 退款 | 订单状态、库存回补（可选） |
| 创建优惠码 | 营销 → 优惠码 | 结账页可用 |
| 给单个客户发邮件 | 营销 → 写邮件 | 客户邮箱、邮件记录（目前没有群发功能） |
| 看谁订阅了邮件、标记退订 | 客户 → 订阅者 | 订阅者列表、退订状态 |
| 处理支付争议/拒付 | 设置 → 支付恢复 / 订单详情 | 争议记录、举证截止时间 |
| 备份 / 恢复数据 | `npm run backup` / `npm run restore` | 全部业务表 + media 图片 |
| 改运费/免邮门槛 | 设置 | 结账页和购物车运费 |
| 清理滞留订单/过期支付数据 | 设置 → 数据维护 | 后台数据 |
| 恢复卡住的支付 | 设置 → 支付恢复 | 查支付平台并补记订单 |

---

## 九、理解这套架构的三个关键词

1. **服务端说了算**
   价格、库存、优惠券、运费都以服务器查数据库的结果为准。浏览器只负责展示和收集表单。

2. **预占 + 事务**
   下单先占库存，付款成功才真正扣；建单、预占、扣库存、改状态、准备邮件都在数据库事务里完成，避免“钱收了但库存没扣”或“库存扣了但订单没建”。

3. **前台缓存，后台直写**
   前台页面为了快，会缓存几十秒到一小时；后台写入数据库是即时的。所以后台改完后，前台可能稍等片刻才看到变化。

---

## 十、一句话总结

**Next.js 负责门面，Supabase 负责仓库和账号，Stripe/PayPal 负责收钱，Resend 负责通知，Vercel 负责托管；后台是一个独立的管理应用，所有关键写入都通过服务端 API 和数据库事务完成。**
