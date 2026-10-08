import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// One-off "we've missed you / please update" campaign for users still on old app versions.
// People come from public.update_email_queue (held for 30 days, then purged by a cron job).
//
// Auth: `x-cron-secret` header == CRON_SECRET, OR a service-role bearer.
// Body (all optional):
//   { "dry_run": true }                      -> report what would be sent, change nothing
//   { "test_to": "me@x.com", "test_platform": "android"|"ios" }
//                                            -> send ONE test copy, subject prefixed [TEST], queue untouched.
//                                               Only addresses that belong to an existing Halal Formosa account.
//   { "cap": 50 }                            -> override the daily cap (max 100, Resend's free-plan daily limit)
// A normal run sends at most the daily cap per Taipei calendar day (default 50), so it is safe to schedule daily:
// it stops by itself when nobody is pending.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('UPDATE_EMAIL_FROM') ?? 'Halal Formosa <noreply@halalformosa.com>'
const APP_BASE = Deno.env.get('DIGEST_APP_BASE') ?? 'https://halalformosa.com'
const DEFAULT_CAP = Number(Deno.env.get('UPDATE_EMAIL_DAILY_CAP') ?? '50')
const SUBJECT = "We've missed you! Halal Formosa v2.0 is here 🌙"
const SEND_DELAY_MS = 600 // Resend allows 2 requests/second

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

async function opsLog(level: 'info' | 'warn' | 'error', event: string, detail: unknown) {
  try { await supabase.from('ops_events').insert({ source: 'send-update-emails', level, event, detail }) } catch { /* never break the job */ }
}

// ---------------------------------------------------------------- content
const EN = {
  lang: 'en',
  hi: 'Hi,',
  title: "We've missed you! 🌙",
  intro: "Halal Formosa is now on v2.0, and a lot has changed since you last visited. Update to the latest version to see what's new. It only takes a minute.",
  missingTitle: "What you've been missing",
  items: [
    ['🔍', 'Smarter scanning', 'Flagged ingredients show up as quick chips on live scan results, with faster scans and more accurate highlights in photos.'],
    ['🏆', 'Achievements & trophies', 'Earn trophies for scanning, reviewing, exploring and contributing, and show your favorite on your profile and the leaderboard.'],
    ['🎁', 'Invite & Earn', 'Share your referral code or QR code with friends and earn rewards when they join.'],
    ['🇮🇩', 'Indonesian Halal Directory', 'Indonesian halal products and restaurants in Taiwan, curated with KDEI Taipei.'],
    ['🕌', 'Prayer times on your home screen', 'Home screen widgets with prayer times, plus a more reliable Qibla compass.'],
    ['🎯', 'Daily missions', 'Your daily completion bonus is now awarded automatically.'],
    ['📍', 'Better places', 'A refreshed Discover section and location-aware prompts to review the places you visit.'],
  ] as [string, string, string][],
  cta: 'Update now',
  foot: "You're getting this one-time message because you have a Halal Formosa account.",
  help: 'Questions? Visit',
}
const ID = {
  lang: 'id',
  hi: 'Halo,',
  title: 'Kami rindu kamu! 🌙',
  intro: 'Halal Formosa kini sudah di v2.0, dan banyak yang berubah sejak kunjungan terakhirmu. Perbarui ke versi terbaru untuk melihat yang baru. Hanya butuh satu menit.',
  missingTitle: 'Yang kamu lewatkan',
  items: [
    ['🔍', 'Pemindaian lebih pintar', 'Bahan yang ditandai muncul sebagai chip cepat di hasil pindai langsung, dengan pemindaian lebih cepat dan sorotan foto yang lebih akurat.'],
    ['🏆', 'Pencapaian & piala', 'Dapatkan piala dari memindai, mengulas, menjelajah, dan berkontribusi, lalu pamerkan favoritmu di profil dan papan peringkat.'],
    ['🎁', 'Undang & Dapatkan', 'Bagikan kode referral atau kode QR-mu ke teman dan dapatkan hadiah saat mereka bergabung.'],
    ['🇮🇩', 'Direktori Halal Indonesia', 'Produk dan restoran halal Indonesia di Taiwan, dikurasi bersama KDEI Taipei.'],
    ['🕌', 'Waktu sholat di layar utama', 'Widget layar utama dengan waktu sholat, plus kompas kiblat yang lebih andal.'],
    ['🎯', 'Misi harian', 'Bonus penyelesaian harianmu kini diberikan otomatis.'],
    ['📍', 'Tempat yang lebih baik', 'Bagian Jelajah yang diperbarui dan pengingat ulasan berdasarkan lokasi untuk tempat yang kamu kunjungi.'],
  ] as [string, string, string][],
  cta: 'Perbarui sekarang',
  foot: 'Kamu menerima pesan satu kali ini karena kamu memiliki akun Halal Formosa.',
  help: 'Ada pertanyaan? Kunjungi',
}

function block(c: typeof EN, storeUrl: string): string {
  const rows = c.items.map(([icon, head, body]) =>
    `<tr><td style="vertical-align:top;padding:7px 10px 7px 0;font-size:20px;line-height:1.3;">${icon}</td>` +
    `<td style="padding:7px 0;color:#444;font-size:14px;line-height:1.5;"><strong style="color:#222;">${esc(head)}</strong><br/>${esc(body)}</td></tr>`).join('')
  return `<p style="color:#444;margin:0 0 6px;font-size:15px;">${esc(c.hi)}</p>
    <h2 style="color:#f08c00;margin:0 0 10px;font-size:22px;">${esc(c.title)}</h2>
    <p style="color:#444;margin:0 0 18px;font-size:15px;line-height:1.55;">${esc(c.intro)}</p>
    <div style="background:#faf6f0;border-radius:14px;padding:16px 18px;">
      <div style="font-weight:800;color:#222;font-size:15px;margin-bottom:4px;">${esc(c.missingTitle)}</div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>
    <p style="margin:20px 0 4px;"><a href="${storeUrl}" style="background:#f08c00;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">${esc(c.cta)}</a></p>`
}

function renderHtml(storeUrl: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:540px;margin:auto;padding:8px;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Halal Formosa v2.0 is here. Update to see what's new.</div>
    <div style="text-align:center;margin:8px 0 20px;">
      <img src="${APP_BASE}/android-chrome-512x512.png" alt="Halal Formosa" width="56" height="56" style="border-radius:14px;display:inline-block;" />
      <div style="font-weight:800;color:#f08c00;font-size:15px;margin-top:6px;letter-spacing:.3px;">Halal Formosa</div>
    </div>
    ${block(EN, storeUrl)}
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0 22px;" />
    ${block(ID, storeUrl)}
    <p style="color:#aaa;font-size:11px;margin-top:26px;line-height:1.5;">${esc(EN.foot)} ${esc(EN.help)} <a href="${APP_BASE}/contact" style="color:#aaa;">${APP_BASE.replace('https://', '')}/contact</a>.<br/>
    ${esc(ID.foot)} ${esc(ID.help)} <a href="${APP_BASE}/contact" style="color:#aaa;">${APP_BASE.replace('https://', '')}/contact</a>.</p>
  </div>`
}

function renderText(storeUrl: string): string {
  const part = (c: typeof EN) =>
    `${c.hi}\n\n${c.title}\n${c.intro}\n\n${c.missingTitle}:\n` +
    c.items.map(([, head, body]) => `- ${head}: ${body}`).join('\n') + `\n\n${c.cta}: ${storeUrl}\n`
  return `${part(EN)}\n----------\n\n${part(ID)}\n${EN.foot} ${EN.help} ${APP_BASE}/contact`
}

// ---------------------------------------------------------------- sending
async function sendOne(to: string, platform: string | null, storeUrls: { android: string; ios: string }, testPrefix = '') {
  const storeUrl = platform === 'ios' ? storeUrls.ios : storeUrls.android
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject: `${testPrefix}${SUBJECT}`, html: renderHtml(storeUrl), text: renderText(storeUrl) }),
  })
  const text = await res.text()
  let id: string | null = null
  try { id = JSON.parse(text)?.id ?? null } catch { /* not JSON */ }
  return { ok: res.ok && !!id, status: res.status, id, error: res.ok ? null : text.slice(0, 300) }
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const authorized = (CRON_SECRET !== '' && secret === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE}`
  if (!authorized) return new Response('Unauthorized', { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const { data: cfg } = await supabase.from('app_config').select('key, value').in('key', ['android_store_url', 'ios_store_url'])
  const cfgMap = Object.fromEntries((cfg ?? []).map((r: any) => [r.key, r.value]))
  const storeUrls = {
    android: cfgMap.android_store_url || 'https://play.google.com/store/apps/details?id=com.rcreative.halalformosa',
    ios: cfgMap.ios_store_url || 'https://apps.apple.com/tw/app/halal-formosa-halal-taiwan/id6771660859',
  }

  // ---- test copy: one email, only to an address that already belongs to a Halal Formosa account
  if (typeof body.test_to === 'string') {
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY not set' }, 500)
    const to = body.test_to.trim().toLowerCase()
    const { data: acct } = await supabase.from('user_profiles').select('id').ilike('email', to).limit(1)
    if (!acct || acct.length === 0) return json({ error: 'test_to must be an existing account email' }, 400)
    const r = await sendOne(to, body.test_platform === 'ios' ? 'ios' : 'android', storeUrls, '[TEST] ')
    await opsLog(r.ok ? 'info' : 'error', r.ok ? 'update_email_test_sent' : 'update_email_test_failed', { status: r.status, id: r.id, error: r.error })
    return json({ test: true, ...r })
  }

  const dryRun = body.dry_run === true
  const cap = Math.min(100, Math.max(0, Number.isFinite(Number(body.cap)) ? Number(body.cap) : DEFAULT_CAP))

  // Taipei calendar day: UTC+8
  const t = new Date(Date.now() + 8 * 3600e3); t.setUTCHours(0, 0, 0, 0)
  const dayStart = new Date(t.getTime() - 8 * 3600e3).toISOString()
  const { count: sentToday } = await supabase.from('update_email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', dayStart)
  const remaining = Math.max(0, cap - (sentToday ?? 0))
  const { count: pending } = await supabase.from('update_email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').gt('expires_at', new Date().toISOString())

  if (dryRun) return json({ dry_run: true, pending, sent_today: sentToday ?? 0, cap, would_send_now: Math.min(remaining, pending ?? 0), resend_key_set: RESEND_API_KEY !== '' })
  if (!RESEND_API_KEY) { await opsLog('error', 'update_email_no_key', {}); return json({ error: 'RESEND_API_KEY not set' }, 500) }
  if (remaining <= 0 || !pending) return json({ sent: 0, reason: remaining <= 0 ? 'daily_cap_reached' : 'nothing_pending', pending, sent_today: sentToday ?? 0, cap })

  // Anything stuck in "sending" from a crashed earlier run may or may not have gone out: don't risk a duplicate.
  await supabase.from('update_email_queue').update({ status: 'failed', error: 'interrupted (not retried to avoid a duplicate)' })
    .eq('status', 'sending').lt('claimed_at', new Date(Date.now() - 3600e3).toISOString())

  const { data: claimed, error: claimErr } = await supabase.rpc('claim_update_emails', { p_limit: remaining })
  if (claimErr) { await opsLog('error', 'update_email_claim_failed', { error: claimErr.message }); return json({ error: claimErr.message }, 500) }

  let sent = 0, failed = 0, requeued = 0
  const rows = (claimed ?? []) as any[]
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    let out
    try { out = await sendOne(r.email, r.platform, storeUrls) } catch (e) { out = { ok: false, status: 0, id: null, error: String(e).slice(0, 300) } }
    if (out.ok) {
      sent++
      await supabase.from('update_email_queue').update({ status: 'sent', sent_at: new Date().toISOString(), resend_id: out.id, error: null }).eq('id', r.id)
    } else if (out.status === 429) {
      // Rate limited: put this one and everyone not yet attempted back, try again on the next run.
      const rest = rows.slice(i).map((x) => x.id)
      await supabase.from('update_email_queue').update({ status: 'pending', claimed_at: null }).in('id', rest)
      requeued = rest.length
      await opsLog('warn', 'update_email_rate_limited', { requeued })
      break
    } else if (out.status >= 500 && r.attempts < 3) {
      await supabase.from('update_email_queue').update({ status: 'pending', claimed_at: null, error: out.error }).eq('id', r.id)
      requeued++
    } else {
      failed++
      await supabase.from('update_email_queue').update({ status: 'failed', error: out.error }).eq('id', r.id)
    }
    await sleep(SEND_DELAY_MS)
  }

  const summary = { sent, failed, requeued, claimed: rows.length, cap, sent_today_before: sentToday ?? 0 }
  await opsLog(failed > 0 ? 'warn' : 'info', 'update_email_run', summary)
  return json(summary)
})
