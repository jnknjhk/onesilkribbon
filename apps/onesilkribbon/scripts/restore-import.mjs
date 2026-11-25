#!/usr/bin/env node
// 从 backup-export.mjs 的产物恢复数据。
//
// 默认是 dry-run：只校验 manifest / SHA-256 / 行数，不写数据库。
// 真正写入需要 --apply --yes；目标库已有订单时还需要 --force。
//
// 用法（在 apps/onesilkribbon 下）：
//   node scripts/restore-import.mjs --dir backups/2026-11-25T...
//   node scripts/restore-import.mjs --dir ... --apply --yes
//   node scripts/restore-import.mjs --dir ... --apply --yes --include-storage
//
// 恢复是 upsert（按主键覆盖），不会删除备份里没有的行。建议恢复到空环境；
// 生产库恢复前先做一次新的备份。

import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { TABLES } from './backup-tables.mjs'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STORAGE_BUCKET = 'media'
const CHUNK = 500

// 这些表的业务唯一键和 UUID 主键是分开的：恢复到已有数据的库时，
// 同一个邮箱/网址/编码可能对应不同的 id，直接 upsert 会失败或写乱。
const NATURAL_KEYS = {
  customers: ['email'],
  subscribers: ['email'],
  newsletter_subscribers: ['email'],
  coupons: ['code'],
  products: ['slug'],
  product_skus: ['sku_code'],
  journal_posts: ['slug'],
  orders: ['order_number'],
}

async function naturalKeyConflicts(client, loaded) {
  const byName = new Map(loaded.map(({ table, rows }) => [table.name, rows]))
  const conflicts = []
  for (const [table, columns] of Object.entries(NATURAL_KEYS)) {
    const backupRows = byName.get(table)
    if (!backupRows?.length) continue
    for (const column of columns) {
      const values = [...new Set(backupRows.map(row => row[column]).filter(value => value != null))]
      for (let i = 0; i < values.length; i += CHUNK) {
        const chunk = values.slice(i, i + CHUNK)
        const { data, error } = await client.from(table).select(`id,${column}`).in(column, chunk)
        if (error) throw new Error(`检查 ${table}.${column} 冲突失败: ${error.message}`)
        for (const existing of data || []) {
          const backup = backupRows.find(row => row[column] === existing[column])
          if (backup && backup.id !== existing.id) conflicts.push(`${table}.${column}=${existing[column]}`)
        }
      }
    }
  }
  return conflicts
}

// 父表在前，避免外键在恢复途中找不到目标。
const RESTORE_ORDER = [
  'settings', 'site_images', 'media', 'coupons', 'journal_posts',
  'customers', 'user_profiles', 'user_addresses', 'subscribers', 'newsletter_subscribers',
  'products', 'product_skus',
  'orders', 'order_items', 'tracking_events',
  'welcome_coupon_claims',
  'payment_checkouts', 'payment_receipts', 'payment_notifications', 'payment_refunds',
  'payment_disputes', 'refund_requests', 'paypal_sessions',
  'checkout_reservations', 'checkout_stock_reservations', 'checkout_requests', 'stripe_checkout_attempts',
  'subscription_email_requests', 'subscription_email_attempts',
  'email_log', 'admin_audit_log',
]

function printHelp() {
  console.log(`用法: node scripts/restore-import.mjs --dir <备份目录> [选项]

  --dir <目录>        必填，backup-export 生成的目录
  --apply             真正写入数据库（默认 dry-run）
  --yes               跳过交互确认（非交互环境必须带）
  --force             目标库已有订单时仍然恢复
  --include-storage   同时把 storage/media 里的文件上传回 Supabase Storage
  -h, --help          显示帮助`)
}

function parseArgs(argv) {
  const opts = { dir: null, apply: false, yes: false, force: false, includeStorage: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dir') {
      opts.dir = argv[++i]
      if (!opts.dir) throw new Error('--dir 需要一个目录参数')
    } else if (arg === '--apply') opts.apply = true
    else if (arg === '--yes') opts.yes = true
    else if (arg === '--force') opts.force = true
    else if (arg === '--include-storage') opts.includeStorage = true
    else if (arg === '-h' || arg === '--help') { printHelp(); process.exit(0) }
    else throw new Error(`未知参数: ${arg}`)
  }
  if (!opts.dir) throw new Error('缺少 --dir')
  return opts
}

async function loadEnvFile(file) {
  let text
  try { text = await fs.readFile(path.join(APP_DIR, file), 'utf8') } catch { return }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex')

function orderedTables() {
  const byName = new Map(TABLES.map(t => [t.name, t]))
  const out = []
  for (const name of RESTORE_ORDER) {
    if (byName.has(name)) { out.push(byName.get(name)); byName.delete(name) }
  }
  out.push(...byName.values()) // 清单之后新增的表也不能漏
  return out
}

async function confirm(message) {
  if (!process.stdin.isTTY) throw new Error('非交互环境请加 --yes 确认')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${message} 输入 yes 继续: `)
  rl.close()
  if (answer.trim().toLowerCase() !== 'yes') throw new Error('已取消')
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase()
  return {
    '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  }[ext] || 'application/octet-stream'
}

async function listLocalFiles(root, prefix = '') {
  const dir = path.join(root, prefix)
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return [] }
  const out = []
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...await listLocalFiles(root, relative))
    else out.push(relative)
  }
  return out
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  await loadEnvFile('.env.local')
  await loadEnvFile('.env')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_KEY')

  const dir = path.resolve(APP_DIR, opts.dir)
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'))
  const manifestTables = new Map((manifest.tables || []).map(t => [t.name, t]))

  console.log(`备份目录: ${dir}`)
  console.log(`备份时间: ${manifest.createdAt || '未知'}`)
  console.log(`目标库:   ${url}`)
  console.log(opts.apply ? '模式: 恢复（会写入数据库）' : '模式: dry-run（只校验，不写入）')
  console.log('')

  const tables = orderedTables()
  const loaded = []
  let totalRows = 0

  for (const table of tables) {
    const file = path.join(dir, `${table.name}.json`)
    let buffer
    try { buffer = await fs.readFile(file) } catch {
      throw new Error(`缺少表文件: ${table.name}.json`)
    }
    const meta = manifestTables.get(table.name)
    if (meta?.sha256 && sha256(buffer) !== meta.sha256) {
      throw new Error(`SHA-256 不匹配: ${table.name}.json（文件可能损坏）`)
    }
    const rows = JSON.parse(buffer.toString('utf8'))
    if (!Array.isArray(rows)) throw new Error(`${table.name}.json 不是数组`)
    if (meta?.rows != null && meta.rows !== rows.length) {
      throw new Error(`${table.name}.json 行数与 manifest 不一致（${rows.length} != ${meta.rows}）`)
    }
    totalRows += rows.length
    loaded.push({ table, rows })
    console.log(`  ${table.name.padEnd(32)} ${String(rows.length).padStart(7)} 行  校验通过`)
  }

  console.log('')
  console.log(`共 ${loaded.length} 张表，${totalRows} 行。`)
  console.log('注意：JSON 备份不含 auth.users 登录账号；恢复后客户需要重新登录/邀请，密码无法从备份恢复。')
  console.log('      登录账号请用 Supabase 平台备份/PITR，或让客户走一次“忘记密码”。')
  if (!opts.apply) {
    console.log('dry-run 完成；加 --apply --yes 才会写入数据库。')
    return
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const nonEmpty = []
  for (const table of tables) {
    const { count, error } = await client.from(table.name).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`无法读取目标表 ${table.name}: ${error.message}（请先执行 supabase/migrations）`)
    if ((count || 0) > 0) nonEmpty.push(`${table.name}(${count})`)
  }
  if (nonEmpty.length && !opts.force) {
    throw new Error(`目标库不是空的：${nonEmpty.join(', ')}。确认要恢复到已有数据的库，请加 --force。`)
  }
  if (nonEmpty.length) {
    const conflicts = await naturalKeyConflicts(client, loaded)
    if (conflicts.length) {
      throw new Error(`目标库存在自然键冲突（同一邮箱/网址/编码对应不同 id）：${conflicts.slice(0, 10).join(', ')}${conflicts.length > 10 ? ' …' : ''}。恢复已中止，未写入任何数据。`)
    }
  }

  if (!opts.yes) await confirm(`即将把 ${totalRows} 行写入 ${url}。`)

  for (const { table, rows } of loaded) {
    if (!rows.length) continue
    const conflict = table.order.join(',')
    // bigserial 主键不写死，否则会和新记录的序列冲突；审计日志本身就是追加表。
    const appendOnly = table.name === 'admin_audit_log'
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map(row => {
        if (!appendOnly) return row
        const { id, ...rest } = row
        return rest
      })
      const { error } = appendOnly
        ? await client.from(table.name).insert(chunk)
        : await client.from(table.name).upsert(chunk, { onConflict: conflict })
      if (error) throw new Error(`${table.name} 写入失败: ${error.message}`)
    }
    console.log(`  ${table.name.padEnd(32)} ${String(rows.length).padStart(7)} 行  已写入`)
  }

  if (opts.includeStorage) {
    const root = path.join(dir, 'storage', STORAGE_BUCKET)
    const files = await listLocalFiles(root)
    let storageManifest = []
    try {
      storageManifest = JSON.parse(await fs.readFile(path.join(dir, 'storage-manifest.json'), 'utf8'))
    } catch { /* 旧备份可能没有 storage-manifest；仍可上传 */ }
    const expected = new Map(storageManifest.map(entry => [entry.path, entry.sha256]))

    console.log('')
    console.log(`恢复存储桶 ${STORAGE_BUCKET}: ${files.length} 个文件`)
    for (const [index, file] of files.entries()) {
      const buffer = await fs.readFile(path.join(root, file))
      if (expected.has(file) && expected.get(file) !== sha256(buffer)) {
        throw new Error(`storage SHA-256 不匹配: ${file}`)
      }
      const { error } = await client.storage.from(STORAGE_BUCKET)
        .upload(file, buffer, { upsert: true, contentType: contentType(file) })
      if (error) throw new Error(`storage upload ${file}: ${error.message}`)
      if ((index + 1) % 25 === 0 || index + 1 === files.length) {
        console.log(`  存储文件 ${index + 1}/${files.length}`)
      }
    }
  }

  console.log('')
  console.log('恢复完成。请到后台抽查订单、商品、退款和支付争议。')
}

main().catch(error => {
  console.error(`恢复失败: ${error.message}`)
  process.exit(1)
})
