import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Weekly digest email for Gold-tier business owners.
// Auth: requires `x-cron-secret` header == CRON_SECRET, OR a service-role bearer.
// Email: sent via Resend (RESEND_API_KEY). No-ops gracefully if the key is unset.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const DIGEST_FROM = Deno.env.get('DIGEST_FROM') ?? 'Halal Formosa <onboarding@resend.dev>'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const APP_BASE = Deno.env.get('DIGEST_APP_BASE') ?? 'https://halalformosa.com'

const COUNTRY: Record<string, string> = {
  ID: 'Indonesia', MY: 'Malaysia', TW: 'Taiwan', PK: 'Pakistan', SG: 'Singapore',
  IN: 'India', BD: 'Bangladesh', BN: 'Brunei', TR: 'Türkiye', TH: 'Thailand',
  PH: 'Philippines', VN: 'Vietnam', SA: 'Saudi Arabia', EG: 'Egypt', US: 'United States',
}

interface DigestRow {
  user_id: string; email: string | null; display_name: string | null;
  location_id: number; location_name: string;
  views_7d: number; views_prev_7d: number;
  saves_7d: number; directions_7d: number; order_taps_7d: number;
  top_nationality: string | null; top_search_term: string | null;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function renderEmail(r: DigestRow, delta: number): string {
  const arrow = delta >= 0 ? '▲' : '▼'
  const color = delta >= 0 ? '#06c167' : '#e11d48'
  const nat = r.top_nationality ? (COUNTRY[r.top_nationality] ?? r.top_nationality) : '—'
  const term = r.top_search_term ? esc(r.top_search_term) : '—'
  const row = (label: string, val: string | number) =>
    `<tr><td style="padding:8px 0;color:#555;">${label}</td><td style="text-align:right;font-weight:700;color:#222;">${val}</td></tr>`
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;padding:8px;">
    <div style="text-align:center;margin:8px 0 20px;">
      <img src="${APP_BASE}/android-chrome-512x512.png" alt="Halal Formosa" width="56" height="56" style="border-radius:14px;display:inline-block;" />
      <div style="font-weight:800;color:#f08c00;font-size:15px;margin-top:6px;letter-spacing:.3px;">Halal Formosa</div>
    </div>
    <h2 style="color:#f08c00;margin:0 0 4px;">${esc(r.location_name)}</h2>
    <p style="color:#666;margin:0 0 16px;">Here's how your listing did this week on Halal Formosa.</p>
    <div style="background:#faf6f0;border-radius:14px;padding:22px;">
      <div style="font-size:36px;font-weight:800;color:#222;">${r.views_7d}
        <span style="font-size:14px;color:${color};font-weight:700;">${arrow} ${Math.abs(delta)}%</span></div>
      <div style="color:#999;font-size:13px;">views this week (vs ${r.views_prev_7d} last week)</div>
    </div>
    <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:15px;">
      ${row('Saves', r.saves_7d)}
      ${row('Direction taps', r.directions_7d)}
      ${row('Delivery-app taps', r.order_taps_7d)}
      ${row('Top visitor nationality', nat)}
      ${row('Top search term', term)}
    </table>
    <p style="margin-top:22px;">
      <a href="${APP_BASE}/business/${r.location_id}" style="background:#f08c00;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;">Open dashboard</a>
    </p>
    <p style="color:#aaa;font-size:11px;margin-top:26px;">You receive this weekly summary because you manage a Gold business on Halal Formosa.</p>
  </div>`
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const authorized = (CRON_SECRET !== '' && secret === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE}`
  if (!authorized) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.rpc('get_business_weekly_digests')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  const rows = (data ?? []) as DigestRow[]

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not set', would_send: rows.length }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sent = 0, failed = 0
  for (const r of rows) {
    if (!r.email) continue
    const delta = r.views_prev_7d > 0
      ? Math.round(((r.views_7d - r.views_prev_7d) / r.views_prev_7d) * 100)
      : (r.views_7d > 0 ? 100 : 0)
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: DIGEST_FROM,
          to: r.email,
          subject: `Your weekly Halal Formosa report — ${r.location_name}`,
          html: renderEmail(r, delta),
        }),
      })
      if (res.ok) sent++
      else { failed++; console.error('resend fail', await res.text()) }
    } catch (e) { failed++; console.error('send error', e) }
  }

  return new Response(JSON.stringify({ sent, failed, total: rows.length }), { headers: { 'Content-Type': 'application/json' } })
})
