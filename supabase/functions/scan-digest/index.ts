import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Weekly ranked digest of repeatedly-scanned barcodes.
// Replaces the per-scan Discord spam with ONE aggregated, ranked message that shows
// both what's worth adding and what's already in the catalog.
// Auth: `x-cron-secret` header == CRON_SECRET, OR a service-role bearer.
// Posts to the Discord "alerts" channel. No-ops gracefully if no webhook is configured.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

// Route to the alerts channel, falling back to the default webhook.
const DISCORD_WEBHOOK =
  Deno.env.get('DISCORD_WEBHOOK_URL_ALERTS') ??
  Deno.env.get('DISCORD_WEBHOOK_URL') ??
  ''

const WEB_BASE_URL = 'https://app.halalformosa.com'
const OFF_UA = 'HalalFormosa/1.0 (support@halalformosa.com)'
const OFF_PRODUCT_BASE = 'https://world.openfoodfacts.org/product'

// Tunables (overridable per-request in the JSON body for manual testing).
const DEFAULT_MIN_COUNT = Number(Deno.env.get('DIGEST_MIN_COUNT') ?? '3')
const DEFAULT_RECENT_DAYS = Number(Deno.env.get('DIGEST_RECENT_DAYS') ?? '7')
const DEFAULT_LIMIT = Number(Deno.env.get('DIGEST_LIMIT') ?? '100')

// How many rows to show per section in the message.
const TO_ADD_CAP = 15
const ADDED_CAP = 10

interface DigestRow {
  barcode: string
  total_scans: number
  distinct_users: number
  recent_scans: number
  first_seen: string
  last_seen: string
  in_catalog: boolean
  product_name: string | null
  product_status: string | null
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })

const peopleStr = (n: number) => (n > 0 ? ` · ${n} ${n === 1 ? 'person' : 'people'}` : '')

// Best-effort product name from Open Food Facts. Returns '' when not found.
async function offName(barcode: string): Promise<string> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
      { headers: { 'User-Agent': OFF_UA }, signal: ctrl.signal },
    )
    clearTimeout(t)
    if (!res.ok) return ''
    const data = await res.json()
    if (data?.status !== 1 || !data?.product) return ''
    const p = data.product
    const name = p.product_name_en || p.product_name || ''
    const brand = p.brands ? String(p.brands).split(',')[0].trim() : ''
    if (name && brand) return `${name} (${brand})`
    return name || brand || ''
  } catch {
    return ''
  }
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const authorized =
    (CRON_SECRET !== '' && secret === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE}`
  if (!authorized) return new Response('Unauthorized', { status: 401 })

  // Optional per-request overrides.
  let minCount = DEFAULT_MIN_COUNT
  let recentDays = DEFAULT_RECENT_DAYS
  let limit = DEFAULT_LIMIT
  try {
    const body = await req.json()
    if (body?.min_count != null) minCount = Number(body.min_count)
    if (body?.recent_days != null) recentDays = Number(body.recent_days)
    if (body?.limit != null) limit = Number(body.limit)
  } catch {
    // No/invalid body — use defaults.
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.rpc('get_unknown_barcode_digest', {
    p_min_count: minCount,
    p_recent_days: recentDays,
    p_limit: limit,
  })
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = (data ?? []) as DigestRow[]

  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'no barcodes met the threshold', min_count: minCount, recent_days: recentDays }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const toAdd = rows.filter((r) => !r.in_catalog).slice(0, TO_ADD_CAP)
  const added = rows.filter((r) => r.in_catalog).slice(0, ADDED_CAP)

  // Enrich only the "to add" rows with Open Food Facts names (concurrent, best-effort).
  const names = await Promise.all(toAdd.map((r) => offName(r.barcode)))

  const sections: string[] = []

  if (toAdd.length) {
    const lines = toAdd.map((r, i) => {
      const name = names[i] ? `**${names[i]}**` : '_not on Open Food Facts_'
      const rank = `\`${String(i + 1).padStart(2, ' ')}.\``
      return `${rank} ${name} — \`${r.barcode}\`\n     ${r.total_scans} scans${peopleStr(r.distinct_users)} · last ${fmtDate(r.last_seen)} · [open](${WEB_BASE_URL}/item/${r.barcode}) · [OFF](${OFF_PRODUCT_BASE}/${r.barcode})`
    })
    sections.push(
      `🛒 **Worth adding** — scanned ${minCount}+ times, not in the catalog\n\n` + lines.join('\n'),
    )
  }

  if (added.length) {
    const lines = added.map((r) => {
      const nm = r.product_name ? r.product_name.slice(0, 70) : '(unnamed)'
      const st = r.product_status ? ` · _${r.product_status}_` : ''
      return `✅ **${nm}** — \`${r.barcode}\` · ${r.total_scans} scans${st}`
    })
    sections.push(`📦 **Already in catalog** — these repeat scans are handled\n\n` + lines.join('\n'))
  }

  const description = sections.join('\n\n​\n')

  if (!DISCORD_WEBHOOK) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'no Discord webhook configured', to_add: toAdd.length, already_added: added.length, preview: description }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const res = await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Halal Formosa Bot',
      embeds: [
        {
          title: '🔎 Unknown-product scan digest',
          description: description.slice(0, 4000),
          color: 0xf08c00,
          footer: { text: `${toAdd.length} to add · ${added.length} already in catalog · scan-digest` },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })

  const ok = res.ok
  if (!ok) console.error('discord post failed', res.status, await res.text())

  return new Response(
    JSON.stringify({ sent: ok, to_add: toAdd.length, already_added: added.length, min_count: minCount, recent_days: recentDays }),
    { status: ok ? 200 : 502, headers: { 'Content-Type': 'application/json' } },
  )
})
