import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Daily push: "your discount code expires soon". One reminder per unused code,
// 3 days before it expires. Called by pg_cron (see the offer_expiry_reminders
// migrations). Mirrors send-visit-review-prompt.
// Auth: requires `x-cron-secret` header == CRON_SECRET, OR a service-role bearer.
// `?dry_run=1` lists what would be sent without pushing to anyone.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const LEGACY_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default
    if (typeof key === 'string' && key !== '') return key
  } catch { /* fall through to the legacy key */ }
  return ''
}
const SECRET_KEY = readSecretKey()
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

interface ReminderRow {
  code_id: string
  user_id: string
  code: string
  offer_title: string
  location_id: number
  location_name: string
  expires_at: string
}

function daysLeft(expiresAt: string): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const authorized =
    (CRON_SECRET !== '' && secret === CRON_SECRET) ||
    (LEGACY_SERVICE_ROLE !== '' && auth === `Bearer ${LEGACY_SERVICE_ROLE}`)
  if (!authorized) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(SUPABASE_URL, SECRET_KEY || LEGACY_SERVICE_ROLE)
  const { data, error } = await supabase.rpc('get_pending_offer_reminders')
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const rows = (data ?? []) as ReminderRow[]

  if (new URL(req.url).searchParams.get('dry_run') === '1') {
    return new Response(
      JSON.stringify({
        dry_run: true,
        pending_count: rows.length,
        key_source: SECRET_KEY ? 'secret' : 'legacy',
        // codes only, no personal data
        codes: rows.map(r => ({ code: r.code, days_left: daysLeft(r.expires_at) })),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!ONESIGNAL_REST_API_KEY || !ONESIGNAL_APP_ID) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'ONESIGNAL_REST_API_KEY or ONESIGNAL_APP_ID not set', pending_count: rows.length }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  let sent = 0
  let failed = 0

  for (const r of rows) {
    const n = daysLeft(r.expires_at)
    const headings = {
      en: 'Your discount code expires soon',
      id: 'Kode diskon Anda segera berakhir',
      ms: 'Kod diskaun anda hampir tamat',
      zh: '您的優惠碼即將到期',
      'zh-Hant': '您的優惠碼即將到期',
      'zh-Hans': '您的優惠码即将到期',
    }
    const contents = {
      en: `Your "${r.offer_title}" code for ${r.location_name} expires in ${n} day${n === 1 ? '' : 's'}. Show it at the counter before then.`,
      id: `Kode "${r.offer_title}" untuk ${r.location_name} berakhir dalam ${n} hari. Tunjukkan di kasir sebelum itu.`,
      ms: `Kod "${r.offer_title}" untuk ${r.location_name} tamat dalam ${n} hari. Tunjukkan di kaunter sebelum itu.`,
      zh: `${r.location_name} 的「${r.offer_title}」優惠碼將在 ${n} 天後到期，請在到期前出示給店家。`,
      'zh-Hant': `${r.location_name} 的「${r.offer_title}」優惠碼將在 ${n} 天後到期，請在到期前出示給店家。`,
      'zh-Hans': `${r.location_name} 的「${r.offer_title}」优惠码将在 ${n} 天后到期，请在到期前出示给店家。`,
    }

    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          filters: [{ field: 'tag', key: 'user_id', relation: '=', value: r.user_id }],
          headings,
          contents,
          data: { link: `myapp://place/${r.location_id}` },
        }),
      })

      if (res.ok) {
        sent++
        await supabase.rpc('mark_offer_code_reminded', { p_code_id: r.code_id })
      } else {
        failed++
        console.error(`[OneSignal] reminder failed for code ${r.code_id}:`, await res.text())
      }
    } catch (e) {
      failed++
      console.error(`[OneSignal] reminder exception for code ${r.code_id}:`, e)
    }
  }

  return new Response(JSON.stringify({ sent, failed, total: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
