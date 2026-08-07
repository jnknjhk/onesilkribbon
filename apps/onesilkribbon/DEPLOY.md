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
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_SECRET_KEY                  = sk_live_...
STRIPE_WEBHOOK_SECRET              = whsec_...（下一步配置）
```

### PayPal（在 developer.paypal.com → My Apps）
```
NEXT_PUBLIC_PAYPAL_CLIENT_ID = AaBbCc...
PAYPAL_SECRET                = secret...
PAYPAL_MODE                  = live
```

### AfterShip（在 aftership.com → API）
```
AFTERSHIP_API_KEY = asat_...
```

### 其他
```
NEXT_PUBLIC_SITE_URL = https://onesilkribbon.com
```

---

## 第四步：配置 Stripe Webhook

1. 登录 Stripe → Developers → Webhooks
2. 点击 **"Add endpoint"**
3. URL 填入：`https://onesilkribbon.com/api/stripe/webhook`
4. 选择事件：`checkout.session.completed` + `payment_intent.payment_failed`
5. 点击 **"Add endpoint"**
6. 复制 **Signing secret**（whsec_...）
7. 填入 Vercel 的 `STRIPE_WEBHOOK_SECRET`

---

## 第五步：初始化数据库

1. 登录 [supabase.com](https://supabase.com)
2. 进入你的项目 → **SQL Editor**
3. 点击 **"New query"**
4. 复制粘贴 `supabase/schema.sql` 的全部内容
5. 点击 **"Run"** ✅

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
