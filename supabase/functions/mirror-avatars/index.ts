// Mirrors Google-hosted profile photos into our own `avatars` bucket.
//
// Why: user_profiles.avatar_url holds hotlinked lh3.googleusercontent.com URLs, which Google
// throttles (HTTP 429) when a screen requests many at once, so avatars render broken.
//
// POST {}                          -> mirrors the CALLER's own avatar (user JWT required)
// POST {after?, limit?}            -> one-off backfill batch, only with header x-backfill-token
//                                     matching BACKFILL_TOKEN below (empty = backfill disabled)
//
// The token is injected only for the duration of a backfill deploy and is empty in the repo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BACKFILL_TOKEN = ''
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const MAX_BYTES = 2 * 1024 * 1024

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Only ever fetch Google's avatar host: the URL comes from user-controlled metadata (SSRF guard).
function isGoogleAvatar(u: string | null): u is string {
  if (!u) return false
  try {
    const p = new URL(u)
    return p.protocol === 'https:' && p.hostname.endsWith('.googleusercontent.com')
  } catch { return false }
}

const sizedUrl = (u: string) => (/=s\d+(-c)?$/.test(u) ? u.replace(/=s\d+(-c)?$/, '=s256-c') : `${u}=s256-c`)

async function mirrorOne(userId: string, avatarUrl: string): Promise<'ok' | string> {
  let res: Response | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(sizedUrl(avatarUrl))
    if (res.ok || (res.status !== 429 && res.status < 500)) break
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
  if (!res || !res.ok) return `download HTTP ${res?.status}`
  const type = (res.headers.get('content-type') || '').split(';')[0]
  if (!EXT[type]) return `content-type ${type}`
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) return 'too large'

  const path = `${userId}/google.${EXT[type]}`
  const { error: upErr } = await admin.storage.from('avatars').upload(path, buf, {
    contentType: type, upsert: true, cacheControl: '31536000',
  })
  if (upErr) return `upload: ${upErr.message}`

  const publicUrl = `${admin.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  // Guard on the old URL so we never clobber an avatar the user changed in the meantime.
  const { error: dbErr } = await admin.from('user_profiles')
    .update({ avatar_url: publicUrl }).eq('id', userId).eq('avatar_url', avatarUrl)
  return dbErr ? `db: ${dbErr.message}` : 'ok'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const body = await req.json().catch(() => ({}))

  // ---- one-off backfill (token-gated) ----
  const token = req.headers.get('x-backfill-token')
  if (token) {
    if (!BACKFILL_TOKEN || token !== BACKFILL_TOKEN) return json({ error: 'forbidden' }, 403)
    const limit = Math.min(Number(body.limit) || 10, 25)
    let q = admin.from('user_profiles').select('id, avatar_url')
      .like('avatar_url', '%googleusercontent.com%').order('id').limit(limit)
    if (body.after) q = q.gt('id', body.after)
    const { data: rows, error } = await q
    if (error) return json({ error: error.message }, 500)

    const failures: { id: string; reason: string }[] = []
    let ok = 0
    for (const row of rows ?? []) {
      const r = isGoogleAvatar(row.avatar_url) ? await mirrorOne(row.id, row.avatar_url) : 'not a google avatar url'
      if (r === 'ok') ok++; else failures.push({ id: row.id, reason: r })
    }
    const { count } = await admin.from('user_profiles').select('id', { count: 'exact', head: true })
      .like('avatar_url', '%googleusercontent.com%')
    return json({ processed: rows?.length ?? 0, ok, failures, remaining_google: count,
      next_after: rows && rows.length === limit ? rows[rows.length - 1].id : null })
  }

  // ---- self mode: mirror the caller's own avatar ----
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await admin.auth.getUser(jwt)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { data: profile } = await admin.from('user_profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  if (!isGoogleAvatar(profile?.avatar_url ?? null)) return json({ status: 'nothing_to_mirror' })
  const r = await mirrorOne(user.id, profile!.avatar_url!)
  return r === 'ok' ? json({ status: 'mirrored' }) : json({ status: 'failed', reason: r }, 502)
})
