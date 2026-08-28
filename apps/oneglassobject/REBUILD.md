# One Glass Object — 前台重建计划

## 这份文件的用途

新站最初是从 One Silk Ribbon 整站复制来的。业主看过之后判断：**沿用丝带站的页面结构去改，
永远改不干净**，决定从零重写。

重建分阶段进行，每个阶段独立完成、独立提交、独立可验证。
**如果对话中断，新对话只要读这个文件，就能从"当前进度"接着做，不依赖任何上下文记忆。**

## 定位

卖的是**手工玻璃摆件 / 玻璃艺术品**（decorative glass objects & art pieces），
不是日用玻璃器皿。这个定位决定了一切设计取舍：

- 单件为主，数量少、单价高、决策周期长 → 页面要留白、要大图、要故事
- 大多数商品**没有规格**（后台建一个默认 SKU），少数有 → 前台只有一个 SKU 时不显示规格选择器
- 强调孤品感、手工痕迹、尺寸与重量、易碎与运输
- 不要"200+ 色号""六大系列"这类靠 SKU 数量取胜的表达——那是丝带生意的逻辑

## 视觉方向（已与业主确认）

- 极简光影 / 白盒画廊
- 背景纯白 `#FFFFFF`，次级 `#FAFAF9`
- 主文字 `#1F2937`，次级 `#6B7280`
- 点缀色**冷灰蓝 `#64748B`**（明确不用金色）
- 边框 `1px solid #E5E7EB`，圆角 2–4px，直角为主
- 标题 Cormorant Garamond，正文 Inter
- Navbar 半透明毛玻璃；商品卡悬停有光线掠过的折射高光

## 保留 vs 重写

**保留（约 7,930 行，与站点定位无关的商务管道）**

    app/api/*              Stripe / PayPal / 订单 / 后台接口
    app/admin/*            后台管理
    app/account/*          客户账户
    app/checkout           结账
    app/login, app/auth    登录鉴权
    lib/*                  购物车、定价、库存
    components/Cart*       购物车组件
    packages/core          共享包

这部分在老站跑通过真实订单，不动。等前台重建完再逐阶段评估要不要重写。

**从零重写（约 3,584 行，丝带 DNA 所在）**

    app/globals.css                    设计系统
    app/layout.jsx                     根布局
    components/Navbar.jsx              导航
    components/Footer.jsx              页脚
    app/page.jsx + app/HomeClient.jsx  首页
    app/collections/**                 系列总览 / 系列页 / 商品详情
    app/products/**                    商品短链
    app/about, faq, care-guide         内容页
    app/bespoke, contact               定制 / 联系
    app/shipping-returns               配送退货

## 阶段划分

每个阶段做完就 `git commit`，构建必须通过、浏览器控制台必须零错误。

- [x] **阶段 0** — 计划文件（本文件）
- [x] **阶段 1** — 设计系统 + 外壳：`globals.css` / `layout.jsx` / `Navbar` / `Footer`
- [ ] **阶段 2** — 首页：Hero + 精选作品 + 系列入口 + 工作室简介
- [ ] **阶段 3** — 系列总览页 + 单系列页
- [ ] **阶段 4** — 商品详情页（重点：孤品感、尺寸参数、易碎说明、单 SKU 不显示选择器）
- [ ] **阶段 5** — 内容页：about / faq / care-guide / bespoke / contact / shipping-returns
- [ ] **阶段 6** — 结账与账户前台的视觉统一（逻辑不动，只改样式）
- [ ] **阶段 7** — 评估 API 层是否需要重写（默认不重写，除非发现真实问题）
- [ ] **阶段 8** — 评估后台是否需要重写（默认不重写）

## 当前进度

**已完成：阶段 0、阶段 1**

阶段 1 交付：
- `app/globals.css` — 全新设计系统。语义令牌 + 旧变量别名（保留区 270 处引用，阶段 6 前不能删）
- `app/layout.jsx` — 字体换成 Cormorant Garamond + Inter；SEO 元数据全部从 `config/site.js` 读，不再硬编码域名
- `components/Navbar.jsx` — 始终毛玻璃，文字品牌标，桌面横排 / 移动全屏菜单，内联 SVG 图标
- `components/Footer.jsx` — 三栏（Collections / Studio / Service）+ 订阅框，移动端手风琴

阶段 1 修掉的一个真实 bug：
原先 `prefers-reduced-motion` 重置写的是 `transition-duration: 0.01ms !important`，
会让 `max-height` 这类"靠过渡揭示内容"的属性卡在起始值，导致**开了"减少动态效果"的用户
点页脚手风琴没反应**。已改成 `transition: none !important`。

**下一步：阶段 2 — 首页**

⚠️ 当前 `app/HomeClient.jsx` 仍是丝带站的旧首页（跑马灯写着 FINE SILK RIBBONS、
"Six expressions of pure silk"），阶段 2 会整个删掉重写。

## 待业主提供（不阻塞骨架，但阻塞最终文案）

1. 价位区间（决定页面的奢侈程度）
2. 是否孤品 / 同款能否复制（决定要不要做稀缺感）
3. 最终系列（当前 `config/site.js` 里四个是占位）
4. 产地与工艺（吹制 / 铸造 / 窑铸，自制还是代工）
5. 是否已有商品图，以及图的风格（白底棚拍 or 场景实拍）
6. 养护方式、定制政策、运费退货、易碎破损处理
7. 真实客服邮箱（当前占位 `hello@oneglassobject.com`）
8. 社媒账号

在这些确定之前，文案一律写成**中性占位**，并在代码里用 `TODO(文案)` 标注，
不要再出现任何 silk / ribbon / wholesale 字样。

## 约定

- 纯 JavaScript，不引入 TypeScript
- 共享包用 `@osr/core/...`，站内用 `@/...`
- 命令在**仓库根目录**运行：`npm run dev --site=oneglassobject`
- **dev 服务运行时不要跑 build**，两者共用 `.next` 会互相踩坏缓存
- 部分文件是 CRLF 换行，用 perl/python 做多行替换时要匹配 `\r?\n`
