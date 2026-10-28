// One-time, idempotent migration of the published source article into the CMS.
// Reads the server credential from the app's existing environment, never prints it.
const fs = require('node:fs/promises')
const path = require('node:path')
const { loadEnvConfig } = require('@next/env')
const { createClient } = require('@supabase/supabase-js')
const app = path.resolve(__dirname, '..')
loadEnvConfig(app)
const seed = require('../content-seeds/halloween-article.json')

async function main() {
  if (!process.env.SUPABASE_SERVICE_KEY) throw Error('The existing server service credential is required')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const audit = path.resolve(app, '../../.codex-remote-attachments/journal-cms-sync-2026-10-28')
  await fs.mkdir(audit, { recursive: true })
  const before = await db.from('journal_posts').select('id,title,slug,is_published').order('created_at')
  if (before.error) throw Error(`Cannot read Journal: ${before.error.code || 'database error'}`)
  await fs.writeFile(path.join(audit, `before-${Date.now()}.json`), JSON.stringify(before.data, null, 2) + '\n')
  const existing = before.data.find(post => post.slug === seed.slug)
  if (!existing) {
    const inserted = await db.from('journal_posts').insert(seed).select('id').single()
    if (inserted.error) throw Error(`Cannot create CMS article: ${inserted.error.code || 'database error'}`)
  }
  // An existing article may have been edited; never overwrite it with seed text.
  const after = await db.from('journal_posts').select('*').eq('slug', seed.slug).single()
  if (after.error) throw Error(`Cannot verify CMS article: ${after.error.code || 'database error'}`)
  const duplicates = await db.from('journal_posts').select('id', { count: 'exact', head: true }).eq('slug', seed.slug)
  if (duplicates.error || duplicates.count !== 1) throw Error('CMS article is not unique')
  await fs.writeFile(path.join(audit, 'article.json'), JSON.stringify(after.data, null, 2) + '\n')
  console.log(JSON.stringify({ created: !existing, id: after.data.id, slug: after.data.slug, published: after.data.is_published, sections: after.data.sections?.length, previous_articles_preserved: before.data.length - Number(!!existing) }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
