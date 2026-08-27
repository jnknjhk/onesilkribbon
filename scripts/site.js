#!/usr/bin/env node
/**
 * 在指定站点上跑 npm 脚本。用法（都在仓库根目录执行）：
 *
 *   npm run dev                      → 默认站点 onesilkribbon
 *   npm run dev --site=newsite       → apps/newsite
 *   SITE=newsite npm run build       → apps/newsite
 *
 * 存在的意义：apps/ 下以后会有多个站点，根目录的脚本不该写死其中一个。
 */
const { spawnSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const DEFAULT_SITE = 'onesilkribbon'

const script = process.argv[2]
if (!script) {
  console.error('用法: node scripts/site.js <dev|build|start|lint> [-- 额外参数]')
  process.exit(1)
}

// --site=xxx 既可能被 npm 解析成 npm_config_site，也可能原样落到 argv 里（直接 node 调用时）
const argv     = process.argv.slice(3)
const siteFlag = argv.find(a => a.startsWith('--site='))
const extra    = argv.filter(a => a !== siteFlag)

const site = (siteFlag && siteFlag.slice('--site='.length)) ||
             process.env.npm_config_site || process.env.SITE || DEFAULT_SITE
const dir  = path.join('apps', site)

if (!fs.existsSync(path.join(__dirname, '..', dir, 'package.json'))) {
  const apps = fs.readdirSync(path.join(__dirname, '..', 'apps'))
  console.error(`找不到站点 "${site}"（${dir}/package.json 不存在）。现有站点: ${apps.join(', ')}`)
  process.exit(1)
}

const result = spawnSync(
  'npm',
  ['run', script, '-w', dir, ...(extra.length ? ['--', ...extra] : [])],
  { stdio: 'inherit', shell: process.platform === 'win32' }
)
process.exit(result.status === null ? 1 : result.status)
