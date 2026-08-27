# One Glass Object — 上线清单

代码已经在同一个仓库里（`apps/oneglassobject`），不需要新建 GitHub 仓库。
下面按顺序做完就能上线。打勾的地方是需要你自己去网页后台操作的。

---

## 第 0 步 ⚠️ 先保护老站（必须最先做，否则可能影响 onesilkribbon 正常部署）

现在 `apps/` 底下有两个 Next.js 应用了，Vercel 的自动识别会出现歧义。
在推代码之前，先去把老站的项目锁定到正确目录：

1. 打开 Vercel → 选中 **onesilkribbon** 项目
2. Settings → Build & Deployment → **Root Directory**
3. 填 `apps/onesilkribbon`，保存

做完这一步，老站以后只会从自己那个目录构建，和新站互不影响。

---

## 第 1 步：建新库的表

1. 打开新建的那个 Supabase 项目 → 左侧 **SQL Editor** → New query
2. 打开本目录下的 `supabase/schema.sql`，**先把最下面 `is_admin_user()` 里的
   `hello@oneglassobject.com` 改成你自己要用来登录后台的邮箱**
3. 把整份内容粘进 SQL Editor，点 Run

跑完之后左侧 Table Editor 里应该能看到 products、orders、media 等 14 张表，
Storage 里应该有一个叫 `media` 的公开 bucket。

---

## 第 2 步：填本地环境变量

打开 `apps/oneglassobject/.env.local`，把所有 `<填写>` 换成真实值。
这个文件不会进 git，只在你自己电脑上生效。

哪些能沿用老站、哪些必须是新的：

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_KEY` | **必须新的**，用新建那个 Supabase 项目的 |
| `STRIPE_SECRET_KEY` | 可以沿用老站同一个 Stripe 账号 |
| `STRIPE_WEBHOOK_SECRET` | **必须新的**，见第 4 步 |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | 可以沿用 |
| `RESEND_API_KEY` | 可以沿用，但新域名要在 Resend 里单独验证一次 |
| `ADMIN_EMAILS` | 和第 1 步里改的那个邮箱保持一致 |
| `SENTRY_ORG` / `SENTRY_PROJECT` | **必须新的**，否则新站报错会跑进老站的 Sentry |

填完在仓库根目录跑：

```bash
npm run dev --site=oneglassobject
```

浏览器打开 http://localhost:3001 。

---

## 第 3 步：新建 Vercel 项目

1. Vercel → Add New → Project → 选同一个 `onesilkribbon` 仓库
2. **Root Directory 填 `apps/oneglassobject`**（这一步不能漏）
3. Environment Variables：把 `.env.local` 里的每一项都加进去，
   其中 `NEXT_PUBLIC_SITE_URL` 改成 `https://oneglassobject.com`
4. Deploy

---

## 第 4 步：接域名和支付回调

1. Vercel 新项目 → Settings → Domains → 添加 `oneglassobject.com`，
   按它给的提示去域名商那里改 DNS
2. 域名生效后，去 Stripe 后台 → Developers → Webhooks → 新建端点，
   地址填 `https://oneglassobject.com/api/stripe/webhook`，
   把它给的 Signing secret 填回 Vercel 的 `STRIPE_WEBHOOK_SECRET` 并重新部署
3. Resend 后台添加并验证 `oneglassobject.com` 这个发信域名

---

## 第 5 步：注册后台管理员账号

1. 打开 `https://oneglassobject.com/admin-login`
2. 用第 1 步里设的那个管理员邮箱注册/登录
3. 进后台先在「设置」里确认运费和包邮门槛，再开始上商品

---

## 第 6 步（可选）：让 Google 收录商品

商品上齐之后，去 Google Merchant Center 注册商品源，
地址填 `https://oneglassobject.com/api/google-feed`。
