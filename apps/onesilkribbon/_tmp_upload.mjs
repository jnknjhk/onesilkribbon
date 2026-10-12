import { createClient } from '@supabase/supabase-js'
import { readFileSync, statSync, writeFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('./.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

const DIR = 'C:/Users/23919/AppData/Local/Temp/claude/C--Users-23919-Desktop-onesilkribbon/f0f87d35-6662-40d4-9f3a-d49e8c1e21e6/scratchpad/preview/img'
const FILES = [
  ['hero.jpg',           'Bridal bouquet with trailing silk ribbon against a cream vintage chair'],
  ['pearl-white.jpg',    'Ivory garden roses with stems wrapped in wide white silk ribbon'],
  ['champagne-gold.jpg', 'Warm bridal bouquet with coral peonies, peach and ivory roses'],
  ['stem-wrap.jpg',      'Florist tying ribbon around the stems of a bouquet on a wooden workbench'],
  ['streamers.jpg',      'White and pale-blue hydrangea bouquet with long trailing ribbons'],
]

const out = {}
for (const [name, alt] of FILES) {
  const buf = readFileSync(`${DIR}/${name}`)
  const path = `journal/${Date.now()}-${name}`
  const { error: upErr } = await sb.storage.from('media').upload(path, buf, { contentType: 'image/jpeg', upsert: false })
  if (upErr) { console.log(`  ❌ ${name}: ${upErr.message}`); continue }
  const { data: u } = sb.storage.from('media').getPublicUrl(path)
  const { error: mErr } = await sb.from('media').insert({
    url: u.publicUrl, path, filename: name, alt_text: alt,
    size_bytes: statSync(`${DIR}/${name}`).size, namespace: 'journal',
  })
  out[name.replace('.jpg','')] = u.publicUrl
  console.log(`  ✓ ${name.padEnd(20)} ${(buf.length/1024).toFixed(0).padStart(4)} KB  ${mErr ? '（媒体库登记失败: '+mErr.message+'）' : '已登记媒体库'}`)
}
console.log('\n图片 URL:')
Object.entries(out).forEach(([k,v])=>console.log(`  ${k.padEnd(16)} ${v}`))
writeFileSync('_tmp_urls.json', JSON.stringify(out, null, 2))
