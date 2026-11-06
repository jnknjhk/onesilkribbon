#!/usr/bin/env node
// 手动导出 Supabase 数据到本地 JSON。产物包含客户邮箱、地址等个人信息，
// 只能存放在本机加密盘，绝不能提交到 git（backups/ 已在 .gitignore 中忽略）。
//
// 用法（在 apps/onesilkribbon 下）：
//   npm run backup -- --dry-run              只统计每张表的行数，不写文件
//   npm run backup                           导出全部表到 backups/<时间戳>/
//   npm run backup -- --include-storage      同时下载 media 存储桶里的文件
//   npm run backup -- --out D:/safe/backup   指定输出目录
//
// 需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_KEY，默认从 .env.local 读取。

import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGE_SIZE = 1000
const STORAGE_BUCKET = 'media'

// order 必须能唯一确定行的顺序，否则分页时可能重复或漏行。
const TABLES = [
  { name: 'products', order: ['id'] },
  { name: 'product_skus', order: ['id'] },
  { name: 'orders', order: ['id'] },
  { name: 'order_items', order: ['id'] },
  { name: 'tracking_events', order: ['id'] },
  { name: 'customers', order: ['id'] },
  { name: 'user_profiles', order: ['id'] },
  { name: 'user_addresses', order: ['id'] },
  { name: 'subscribers', order: ['id'] },
  { name: 'newsletter_subscribers', order: ['id'] },
  { name: 'coupons', order: ['id'] },
  { name: 'welcome_coupon_claims', order: ['token'] },
  { name: 'journal_posts', order: ['id'] },
  { name: 'site_images', order: ['key'] },
  { name: 'media', order: ['id'] },
  { name: 'settings', order: ['key'] },
  { name: 'email_log', order: ['id'] },
  { name: 'payment_checkouts', order: ['order_number'] },
  { name: 'payment_receipts', order: ['provider', 'payment_id'] },
  { name: 'payment_notifications', order: ['order_number'] },
  { name: 'refund_requests', order: ['order_id'] },
  { name: 'paypal_sessions', order: ['id'] },
  { name: 'checkout_reservations', order: ['order_number'] },
  { name: 'checkout_stock_reservations', order: ['order_number', 'sku_id'] },
  { name: 'stripe_checkout_attempts', order: ['order_number'] },
  { name: 'subscription_email_requests', order: ['id'] },
  { name: 'subscription_email_attempts', order: ['id'] },
]

function printHelp() {
  console.log(`用法: node scripts/backup-export.mjs [选项]

  --dry-run           只统计每张表行数，不写文件
  --include-storage   同时下载 ${STORAGE_BUCKET} 存储桶（可能较大）
  --out <目录>        输出目录，默认 backups/<UTC 时间戳>
  -h, --help          显示帮助`)
}

function parseArgs(argv) {
  const opts = { dryRun: false, includeStorage: false, out: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--include-storage') opts.includeStorage = true
    else if (arg === '--out') {
      opts.out = argv[++i]
      if (!opts.out) throw new Error('--out 需要一个目录参数')
    } else if (arg === '-h' || arg === '--help') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`未知参数: ${arg}`)
    }
  }
  return opts
}

async function loadEnvFile(file) {
  let text
  try {
    text = await fs.readFile(path.join(APP_DIR, file), 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

function tableError(table, error) {
  const wrapped = new Error(`${table.name}: ${error.message} (${error.code || 'no code'})`)
  wrapped.code = error.code
  return wrapped
}

function isMissingTable(error) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

function timestamp() {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z')
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function countTable(client, table) {
  let query = client.from(table.name).select('*', { count: 'exact', head: true })
  for (const column of table.order) query = query.order(column, { ascending: true })
  const { count, error } = await query
  if (error) throw tableError(table, error)
  return count ?? 0
}

async function fetchTable(client, table) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client
      .from(table.name)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    for (const column of table.order) query = query.order(column, { ascending: true })
    const { data, error } = await query
    if (error) throw tableError(table, error)
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

async function listStorageFiles(client, prefix = '') {
  const files = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`storage list ${prefix || '/'}: ${error.message}`)
    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name
      // 目录项的 id 和 metadata 都是 null
      if (item.id === null && item.metadata === null) {
        files.push(...await listStorageFiles(client, itemPath))
      } else {
        files.push({ path: itemPath, size: item.metadata?.size ?? null })
      }
    }
    if (data.length < PAGE_SIZE) return files
  }
}

function safeJoin(root, relativePath) {
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`非法存储路径: ${relativePath}`)
  }
  return target
}

async function exportStorage(client, backupDir) {
  const root = path.join(backupDir, 'storage', STORAGE_BUCKET)
  const files = await listStorageFiles(client)
  const entries = []
  let totalBytes = 0
  for (const [index, file] of files.entries()) {
    const { data, error } = await client.storage.from(STORAGE_BUCKET).download(file.path)
    if (error) throw new Error(`storage download ${file.path}: ${error.message}`)
    const buffer = Buffer.from(await data.arrayBuffer())
    const target = safeJoin(root, file.path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, buffer)
    totalBytes += buffer.length
    entries.push({ ...file, bytes: buffer.length, sha256: sha256(buffer) })
    if ((index + 1) % 25 === 0 || index + 1 === files.length) {
      console.log(`  存储文件 ${index + 1}/${files.length}`)
    }
  }
  await fs.writeFile(path.join(backupDir, 'storage-manifest.json'), JSON.stringify(entries, null, 2))
  return { files: entries.length, totalBytes }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  await loadEnvFile('.env.local')
  await loadEnvFile('.env')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) {
    console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_KEY。')
    console.error('请在 apps/onesilkribbon/.env.local 中配置，或先 export 这两个变量。')
    process.exit(1)
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  console.log(`目标: ${url}`)
  console.log(opts.dryRun ? '模式: dry-run（只统计行数）' : '模式: 完整导出')
  console.log('')

  if (opts.dryRun) {
    let total = 0
    let failed = 0
    for (const table of TABLES) {
      try {
        const count = await countTable(client, table)
        total += count
        console.log(`  ${table.name.padEnd(32)} ${String(count).padStart(7)} 行`)
      } catch (error) {
        failed++
        const missing = isMissingTable(error) ? '（表不存在）' : ''
        console.error(`  ${table.name.padEnd(32)} 失败: ${error.message}${missing}`)
      }
    }
    console.log('')
    console.log(`共 ${TABLES.length - failed}/${TABLES.length} 张表可读，合计 ${total} 行。`)
    if (failed) process.exit(1)
    return
  }

  const outDir = opts.out
    ? path.resolve(APP_DIR, opts.out)
    : path.join(APP_DIR, 'backups', timestamp())
  await fs.mkdir(outDir, { recursive: true })

  const manifest = {
    createdAt: new Date().toISOString(),
    supabaseUrl: url,
    includeStorage: opts.includeStorage,
    tables: [],
    errors: [],
    totalRows: 0,
    totalBytes: 0,
  }

  for (const table of TABLES) {
    try {
      const rows = await fetchTable(client, table)
      const buffer = Buffer.from(JSON.stringify(rows))
      await fs.writeFile(path.join(outDir, `${table.name}.json`), buffer)
      manifest.tables.push({
        name: table.name,
        rows: rows.length,
        bytes: buffer.length,
        sha256: sha256(buffer),
      })
      manifest.totalRows += rows.length
      manifest.totalBytes += buffer.length
      console.log(`  ${table.name.padEnd(32)} ${String(rows.length).padStart(7)} 行`)
    } catch (error) {
      manifest.errors.push({ table: table.name, error: error.message })
      console.error(`  ${table.name.padEnd(32)} 失败: ${error.message}`)
    }
  }

  if (opts.includeStorage) {
    console.log('')
    console.log('导出 media 存储桶…')
    try {
      const storage = await exportStorage(client, outDir)
      manifest.storage = storage
      manifest.totalBytes += storage.totalBytes
    } catch (error) {
      manifest.errors.push({ table: `storage:${STORAGE_BUCKET}`, error: error.message })
      console.error(`  存储桶导出失败: ${error.message}`)
    }
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log('')
  console.log(`输出目录: ${outDir}`)
  console.log(`数据表: ${manifest.tables.length}/${TABLES.length}，合计 ${manifest.totalRows} 行`)
  console.log(`文件大小: ${(manifest.totalBytes / 1024 / 1024).toFixed(2)} MB`)
  if (manifest.errors.length) {
    console.error(`有 ${manifest.errors.length} 项失败，详见 manifest.json。`)
    process.exit(1)
  }
  console.log('备份完成。请把该目录复制到加密盘或离线存储，不要提交到 git。')
}

main().catch(error => {
  console.error(`备份失败: ${error.message}`)
  process.exit(1)
})
