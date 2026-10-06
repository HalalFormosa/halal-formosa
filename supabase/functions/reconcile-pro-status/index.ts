import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Daily safety net: re-checks everyone who is (or ever was) Pro against RevenueCat and repairs
// user_subscriptions / user_profiles.is_donor when the webhook missed or lost an event.
// Auth: `x-cron-secret` header == CRON_SECRET, OR a service-role bearer.
// Body / query: { "dry_run": true } reports mismatches without changing anything.
// Never downgrades a user RevenueCat has no record of (manual grants stay untouched).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const RC_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? ''

const DISCORD_ALERTS = Deno.env.get('DISCORD_WEBHOOK_URL_ALERTS') ?? Deno.env.get('DISCORD_WEBHOOK_URL') ?? ''
const opsClient = createClient(SUPABASE_URL, SERVICE_ROLE)

// Persist what the job did (visible to admins in ops_events) and alert Discord when it had to repair or hit errors.
async function opsLog(level: 'info' | 'warn' | 'error', event: string, detail: unknown) {
  try { await opsClient.from('ops_events').insert({ source: 'reconcile-pro-status', level, event, detail }) } catch { /* never break the job */ }
}
async function alert(text: string) {
  if (!DISCORD_ALERTS) return
  try {
    await fetch(DISCORD_ALERTS, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Halal Formosa Bot', content: text.slice(0, 1900) }) })
  } catch { /* ignore */ }
}

const PRO_ENTITLEMENT = 'Halal Formosa Pro'
const CONCURRENCY = 4
const EXPIRY_TOLERANCE_MS = 60_000

type Candidate = {
  user_id: string
  donor_type: string | null
  is_donor: boolean | null
  entitlement_active: boolean | null
  latest_expiration_at: string | null
}

type RcState = {
  known: boolean
  active: boolean
  expiresAt: string | null
  willRenew: boolean
  productId: string | null
  firstPurchaseAt: string | null
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fetchRcState(userId: string): Promise<RcState> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { 'Authorization': `Bearer ${RC_SECRET_API_KEY}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`RC ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const sub = (await res.json())?.subscriber ?? {}
  const ent = sub.entitlements?.[PRO_ENTITLEMENT]
  const subs = sub.subscriptions ?? {}
  const known = Boolean(ent) || Object.keys(subs).length > 0 || Object.keys(sub.non_subscriptions ?? {}).length > 0

  const now = Date.now()
  const expiresMs = ent?.expires_date ? Date.parse(ent.expires_date) : null
  const graceMs = ent?.grace_period_expires_date ? Date.parse(ent.grace_period_expires_date) : null
  const active = Boolean(ent) && (expiresMs === null || expiresMs > now || (graceMs !== null && graceMs > now))

  const productId: string | null = ent?.product_identifier ?? null
  const productSub = productId ? subs[productId] : null
  return {
    known,
    active,
    expiresAt: ent?.expires_date ?? null,
    willRenew: active && productSub ? !productSub.unsubscribe_detected_at : false,
    productId,
    firstPurchaseAt: productSub?.original_purchase_date ?? ent?.purchase_date ?? null,
  }
}

function needsFix(c: Candidate, rc: RcState): string | null {
  const dbPro = c.entitlement_active === true || c.donor_type === 'Pro'
  if (rc.active !== dbPro) return rc.active ? 'rc_active_db_free' : 'rc_inactive_db_pro'
  if (rc.active && rc.expiresAt && c.latest_expiration_at) {
    const drift = Math.abs(Date.parse(rc.expiresAt) - Date.parse(c.latest_expiration_at))
    if (drift > EXPIRY_TOLERANCE_MS) return 'expiry_drift'
  }
  return null
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const authorized = (CRON_SECRET !== '' && secret === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE}`
  if (!authorized) return new Response('Unauthorized', { status: 401 })
  if (RC_SECRET_API_KEY === '') return json({ error: 'REVENUECAT_SECRET_KEY not configured' }, 500)

  let dryRun = new URL(req.url).searchParams.get('dry_run') === '1'
  try { dryRun = dryRun || (await req.json())?.dry_run === true } catch { /* empty body is fine */ }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: candidates, error } = await supabase.rpc('pro_reconcile_candidates')
  if (error) return json({ error: error.message }, 500)

  const fixed: Array<{ user_id: string; reason: string; rc_active: boolean }> = []
  const unknownToRc: string[] = []
  const errors: Array<{ user_id: string; error: string }> = []
  const queue: Candidate[] = [...(candidates ?? [])]

  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const rc = await fetchRcState(c.user_id)
        if (!rc.known) { unknownToRc.push(c.user_id); continue }
        const reason = needsFix(c, rc)
        if (!reason) continue
        if (!dryRun) {
          const { error: syncError } = await supabase.rpc('sync_user_pro_status', {
            p_user_id: c.user_id,
            p_active: rc.active,
            p_expires_at: rc.expiresAt,
            p_will_renew: rc.willRenew,
            p_first_purchase_at: rc.firstPurchaseAt,
            p_product_id: rc.productId,
            p_revenuecat_user_id: null,
          })
          if (syncError) throw new Error(syncError.message)
        }
        fixed.push({ user_id: c.user_id, reason, rc_active: rc.active })
      } catch (e) {
        errors.push({ user_id: c.user_id, error: String(e).slice(0, 200) })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const summary = { dry_run: dryRun, checked: candidates?.length ?? 0, fixed: fixed.length, mismatches: fixed, unknown_to_rc: unknownToRc.length, errors }
  console.log('[reconcile-pro-status]', JSON.stringify(summary))

  if (!dryRun) {
    if (errors.length > 0) {
      await opsLog('error', 'reconcile_errors', summary)
      await alert(`**🚨 Pro-status reconcile hit ${errors.length} error(s)**\n${errors.slice(0, 3).map((e) => `• ${e.user_id.slice(0, 8)}…: ${e.error}`).join('\n')}`)
    }
    if (fixed.length > 0) {
      // Something was out of sync (the webhook missed or lost an event) and has just been repaired.
      await opsLog('warn', 'mismatch_repaired', summary)
      await alert(`**🔧 Pro-status reconcile repaired ${fixed.length} user(s)**\nThe webhook had missed these:\n${fixed.slice(0, 5).map((f) => `• ${f.user_id.slice(0, 8)}…: ${f.reason}`).join('\n')}`)
    }
    if (errors.length === 0 && fixed.length === 0) {
      await opsLog('info', 'reconcile_ok', { checked: summary.checked, unknown_to_rc: summary.unknown_to_rc })
    }
  }
  return json(summary)
})
