# 数据备份与恢复

数据库和媒体文件都在 Supabase。线上数据的最后一道保险不是代码，而是可用的备份和验证过的恢复流程。

本项目的备份分两层，两层都要有：

| 层级 | 作用 | 频率 |
| --- | --- | --- |
| Supabase 平台备份 / PITR | 整库恢复到某个时间点 | 平台自动 |
| `scripts/backup-export.mjs` 本地导出 | 可审计、可单表恢复、可离线保存 | 每周 + 大改前 |

---

## 一、Supabase 原生备份（先去后台确认）

打开 Supabase Dashboard → 项目 → **Database → Backups**，确认四件事：

1. **当前计划**：Free 计划只有每日备份且保留期短；Pro 计划才支持 PITR。
2. **最近一次备份时间**：如果超过 24 小时，说明自动备份没有正常工作。
3. **保留天数**：决定你最多能回到多久以前。
4. **是否开启 PITR**（Point in Time Recovery）：按小时级恢复，属于付费加购项。订单、支付类数据建议开启。

> 如果计划或保留期不满足要求，在 **Project Settings → Billing** 升级或加购。这是唯一能在“误删整张表”时救回数据的机制，本地导出不能替代。

恢复演练：至少在一个测试项目上走一遍恢复流程。第一次使用恢复功能不要发生在真实事故里。

---

## 二、本地导出脚本

脚本位置：`apps/onesilkribbon/scripts/backup-export.mjs`
依赖：`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_KEY`（默认从 `apps/onesilkribbon/.env.local` 读取）。

### 只检查连通性和行数（不写任何文件）

```bash
cd apps/onesilkribbon
npm run backup -- --dry-run
```

输出每张表是否可读、各有多少行。任何一张表失败都会以非零状态退出。

### 完整导出

```bash
cd apps/onesilkribbon
npm run backup
```

导出到 `apps/onesilkribbon/backups/<UTC 时间戳>/`，每张表一个 JSON 文件，另有 `manifest.json` 记录行数、字节数和 SHA-256。

### 同时备份媒体文件

```bash
cd apps/onesilkribbon
npm run backup -- --include-storage
```

会递归下载 `media` 存储桶到 `backups/<时间戳>/storage/media/`，并生成 `storage-manifest.json`。

### 指定输出目录

```bash
cd apps/onesilkribbon
npm run backup -- --out D:/secure-backups/osr
```

### 输出结构

```
backups/2026-11-06T08-30-00Z/
├── products.json
├── product_skus.json
├── orders.json
├── order_items.json
├── ...
├── manifest.json
├── storage-manifest.json        # 仅 --include-storage
└── storage/media/...            # 仅 --include-storage
```

`manifest.json` 里的 `errors` 数组为空才代表这次备份完整；有任何失败项时脚本会以非零状态退出。

### 注意

- **产物含客户姓名、邮箱、电话、地址**。只能放在本机加密盘或离线介质，不要上传网盘、不要提交 git。`backups/` 已在 `.gitignore` 中忽略。
- **JSON 备份不含 `auth.users` 登录账号和密码**。它只覆盖业务表；整库恢复登录能力请用 Supabase Backups / PITR。用本脚本恢复到空项目后，客户需要重新登录或走一次“忘记密码”。
- `SUPABASE_SERVICE_KEY` 拥有全部权限，只在本机环境变量里使用，不要写进任何会提交的文件。
- 脚本按主键每 1000 行分页，避免 PostgREST 默认行数上限导致静默截断。
- 以后新增数据表时，把表名和排序主键加进 `scripts/backup-tables.mjs`（导出和恢复共用这一份）。
  `--dry-run` 只能检查清单里的表；没有加进清单的表它看不到。`tests/ops-integrity.test.cjs` 会守住
  订单、退款、争议、审计等关键表，但 schema 新增表仍需要人工补。

---

## 三、恢复

优先用 Supabase Backups / PITR 恢复整库；本地 JSON 备份用于 PITR 不可用、或只需要把数据搬回空环境的情况。

### 用恢复脚本（推荐）

```bash
# 只校验：读 manifest、核对 SHA-256 和行数，不写数据库
npm run restore -- --dir backups/<时间戳>

# 真正写入（目标库已有订单时还需要 --force）
npm run restore -- --dir backups/<时间戳> --apply --yes

# 同时恢复 media 图片
npm run restore -- --dir backups/<时间戳> --apply --yes --include-storage
```

- 恢复按**外键顺序**写入（客户 → 商品 → 订单 → 支付/退款/争议），并按主键 upsert。
- 旧备份里不存在的表会自动跳过（例如备份早于支付争议功能上线）；manifest 里有但文件丢失才算损坏。
- 默认拒绝恢复到**任何非空表**的库；确认要覆盖请加 `--force`。
- 加 `--force` 后会先检查自然键冲突（邮箱、商品网址、优惠码、订单号等）。
  同一业务键在目标库对应不同 id 时，脚本会在**写入任何数据之前**中止。
- JSON 备份不含 `auth.users` 登录账号；恢复后客户需要重新登录或重置密码。
- 恢复前先把**当前**数据再导出一次，避免覆盖还没备份的新数据。
- `admin_audit_log` 是追加表，恢复时不写死自增 id，重复恢复会产生重复审计行。

### 手动恢复（单表）

| 场景 | 做法 |
| --- | --- |
| 只有某张表出问题 | 从本地导出的 `<table>.json` 用 service key 逐条 upsert；注意外键顺序（先 `orders` 再 `order_items`） |
| 媒体文件丢失 | 从 `storage/media/` 重新上传，`storage-manifest.json` 里的 SHA-256 可用于校验 |
| 只想查历史值 | 直接读 JSON，不要写回线上 |

---

## 四、上线检查清单

- [ ] Supabase 计划与备份保留期已确认
- [ ] 最近一次自动备份在 24 小时以内
- [ ] 订单/支付数据是否需要 PITR，已决定
- [ ] `npm run backup -- --dry-run` 全部通过
- [ ] 完整导出成功，`manifest.json` 的 `errors` 为空
- [ ] 导出目录已复制到加密盘或离线介质
- [ ] 每月至少做一次恢复演练（可在测试项目）
- [ ] 大版本迁移、批量改价、批量删数据之前，先手动导出一次
