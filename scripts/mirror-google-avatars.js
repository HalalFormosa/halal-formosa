// One-off backfill: copies Google-hosted avatars into our own `avatars` bucket.
//
// Why: user_profiles.avatar_url holds hotlinked lh3.googleusercontent.com URLs, which
// Google throttles (HTTP 429) when a list screen requests many at once, so avatars show
// up broken. Mirroring them to Supabase Storage makes them load reliably.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/mirror-google-avatars.js             # dry run (default): fetches, uploads nothing
//     node scripts/mirror-google-avatars.js --apply     # upload + update user_profiles.avatar_url
//     node scripts/mirror-google-avatars.js --apply --limit 20   # try a small batch first
//
// Safe to re-run: only rows still pointing at googleusercontent.com are touched, and a
// failed download leaves that row unchanged. Files go to avatars/<user_id>/google.<ext>,
// matching the bucket's per-user-folder policies.
//
// Apply migration 20261003130000_keep_mirrored_avatar_on_auth_sync.sql BEFORE --apply,
// otherwise the next Google login overwrites the mirrored URL again.
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity
const CONCURRENCY = 4
const PAUSE_MS = 250 // gentle on Google: they are what rate-limited us in the first place

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Google serves =s96-c by default; ask for 256px, plenty for the 72px profile avatar.
function sizedUrl(u) {
  return /=s\d+(-c)?$/.test(u) ? u.replace(/=s\d+(-c)?$/, '=s256-c') : `${u}=s256-c`
}

async function download(u) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(sizedUrl(u))
    if (res.ok) {
      const type = (res.headers.get('content-type') || '').split(';')[0]
      if (!EXT[type]) throw new Error(`unexpected content-type ${type}`)
      return { buf: Buffer.from(await res.arrayBuffer()), type }
    }
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * attempt); continue }
    throw new Error(`HTTP ${res.status}`) // 404 etc: photo is gone, don't retry
  }
  throw new Error('gave up after retries (429/5xx)')
}

async function mirror(row) {
  const { buf, type } = await download(row.avatar_url)
  if (!APPLY) return { bytes: buf.length }

  const path = `${row.id}/google.${EXT[type]}`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, buf, {
    contentType: type, upsert: true, cacheControl: '31536000',
  })
  if (upErr) throw new Error(`upload: ${upErr.message}`)

  // Versioned query string so a later re-mirror busts CDN/browser caches.
  const publicUrl = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  // Guard on the old URL so we never clobber an avatar the user changed mid-run.
  const { error: dbErr } = await supabase.from('user_profiles')
    .update({ avatar_url: publicUrl }).eq('id', row.id).eq('avatar_url', row.avatar_url)
  if (dbErr) throw new Error(`db update: ${dbErr.message}`)
  return { bytes: buf.length }
}

async function main() {
  console.log(APPLY ? 'APPLY mode: uploading and updating rows' : 'DRY RUN: downloading only, nothing written (use --apply)')
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('user_profiles').select('id, avatar_url')
      .like('avatar_url', '%googleusercontent.com%').order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
  }
  const todo = rows.slice(0, LIMIT)
  console.log(`${rows.length} Google avatars found, processing ${todo.length}`)

  let ok = 0, bytes = 0, i = 0
  const failures = []
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < todo.length) {
      const row = todo[i++]
      try { const r = await mirror(row); ok++; bytes += r.bytes }
      catch (e) { failures.push({ id: row.id, reason: e.message }) }
      if ((ok + failures.length) % 50 === 0) console.log(`  ${ok + failures.length}/${todo.length}`)
      await sleep(PAUSE_MS)
    }
  }))

  console.log(`\nDone: ${ok} ok (${(bytes / 1024 / 1024).toFixed(1)} MB), ${failures.length} failed`)
  failures.slice(0, 20).forEach((f) => console.log(`  ${f.id}: ${f.reason}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
