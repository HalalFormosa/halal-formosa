import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// RevenueCat webhook. Two independent things it drives:
// 1. Business tier (account-level) -> apply_owner_business_tier, fans out to locations.
// 2. Personal "Halal Formosa Pro" entitlement -> mirrors it into pro_subscriptions and,
//    the first time a referred user converts, processes the referral reward (cash
//    commission or free Pro days for both sides, decided by referral_config.mode at
//    that exact moment).
// Auth: RevenueCat 'Authorization' header must equal REVENUECAT_WEBHOOK_SECRET.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? ''
const RC_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? ''

const PRO_ENTITLEMENT = 'Halal Formosa Pro'

// ---- Operational visibility: every processed event / failure is recorded in ops_events, and failures alert Discord ----
const DISCORD_ALERTS = Deno.env.get('DISCORD_WEBHOOK_URL_ALERTS') ?? Deno.env.get('DISCORD_WEBHOOK_URL') ?? ''
const ops = createClient(SUPABASE_URL, SERVICE_ROLE)

async function opsLog(level: 'info' | 'warn' | 'error', event: string, userId: string | null, detail: unknown) {
  try { await ops.from('ops_events').insert({ source: 'revenuecat-webhook', level, event, user_id: userId, detail }) } catch { /* never break the webhook */ }
}

// At most one Discord alert per key every 15 minutes (RevenueCat retries failures, which would otherwise spam).
async function alertOnce(key: string, text: string) {
  try {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data } = await ops.from('ops_events').select('id').eq('source', 'revenuecat-webhook').eq('event', 'alert_sent')
      .eq('detail->>key', key).gte('created_at', since).limit(1)
    if (data && data.length > 0) return
    await ops.from('ops_events').insert({ source: 'revenuecat-webhook', level: 'warn', event: 'alert_sent', detail: { key } })
    if (DISCORD_ALERTS) {
      await fetch(DISCORD_ALERTS, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Halal Formosa Bot', content: text.slice(0, 1900) }) })
    }
  } catch { /* alerting must never break the webhook */ }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIVE = new Set(['INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','UNCANCELLATION','NON_RENEWING_PURCHASE','SUBSCRIPTION_EXTENDED'])

function tierFrom(str: string): 'bronze' | 'silver' | 'gold' | null {
  const s = str.toLowerCase()
  if (s.includes('gold')) return 'gold'
  if (s.includes('silver')) return 'silver'
  if (s.includes('bronze')) return 'bronze'
  return null
}

// Grants N free days of the Pro entitlement server-to-server, no store
// involvement. RevenueCat's `duration` enum is deprecated in favor of an
// explicit end_time_ms, which is what lets us grant an arbitrary day count
// instead of only fixed weekly/monthly buckets.
async function grantPromotionalDays(appUserId: string, days: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!RC_SECRET_API_KEY) return { ok: false, error: 'REVENUECAT_SECRET_KEY not configured' }
  const endTimeMs = Date.now() + days * 24 * 60 * 60 * 1000
  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(PRO_ENTITLEMENT)}/promotional`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RC_SECRET_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_time_ms: endTimeMs }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `RC ${res.status}: ${text.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// Mirrors the Pro entitlement into user_subscriptions + user_profiles.is_donor
// (what the app and admin views read). Returns an error message, or null on success.
async function syncUserProStatus(
  supabase: ReturnType<typeof createClient>,
  appUserId: string,
  ev: any,
  active: boolean,
  willRenew: boolean | null,
): Promise<string | null> {
  const ms = (v: unknown) => (typeof v === 'number' ? new Date(v).toISOString() : null)
  const { error } = await supabase.rpc('sync_user_pro_status', {
    p_user_id: appUserId,
    p_active: active,
    p_expires_at: ms(ev.expiration_at_ms),
    p_will_renew: willRenew,
    p_first_purchase_at: ev.type === 'INITIAL_PURCHASE' ? ms(ev.purchased_at_ms) : null,
    p_product_id: ev.product_id ?? null,
    p_revenuecat_user_id: ev.original_app_user_id ?? null,
  })
  return error ? error.message : null
}

// TRANSFER events carry no entitlement info, so ask RevenueCat for each affected user's
// current state and mirror it. Returns an error message, or null on success.
async function syncAfterTransfer(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  if (!RC_SECRET_API_KEY) return 'REVENUECAT_SECRET_KEY not configured'
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { 'Authorization': `Bearer ${RC_SECRET_API_KEY}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) return `RC ${res.status}`
  const sub = (await res.json())?.subscriber ?? {}
  const ent = sub.entitlements?.[PRO_ENTITLEMENT]
  const known = Boolean(ent) || Object.keys(sub.subscriptions ?? {}).length > 0
  if (!known) return null // nothing to mirror; never downgrade users RevenueCat has no record of

  const expiresMs = ent?.expires_date ? Date.parse(ent.expires_date) : null
  const active = Boolean(ent) && (expiresMs === null || expiresMs > Date.now())
  const productSub = ent?.product_identifier ? sub.subscriptions?.[ent.product_identifier] : null
  const { error } = await supabase.rpc('sync_user_pro_status', {
    p_user_id: userId,
    p_active: active,
    p_expires_at: ent?.expires_date ?? null,
    p_will_renew: active && productSub ? !productSub.unsubscribe_detected_at : false,
    p_first_purchase_at: productSub?.original_purchase_date ?? ent?.purchase_date ?? null,
    p_product_id: ent?.product_identifier ?? null,
    p_revenuecat_user_id: null,
  })
  return error ? error.message : null
}

async function handle(req: Request, ctx: { type?: string; user?: string; product?: string }): Promise<Response> {
  const auth = req.headers.get('authorization') ?? ''
  if (WEBHOOK_SECRET === '' || auth !== WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 })

  let body: any
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const ev = body?.event
  if (!ev) return new Response(JSON.stringify({ ignored: 'no event' }), { headers: { 'Content-Type': 'application/json' } })
  ctx.type = ev.type
  ctx.product = ev.product_id
  if (typeof ev.app_user_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ev.app_user_id)) ctx.user = ev.app_user_id

  if (ev.type === 'TRANSFER') {
    const ids: string[] = [...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])].filter((id: string) => UUID_RE.test(id))
    const transferClient = createClient(SUPABASE_URL, SERVICE_ROLE)
    for (const id of ids) {
      const err = await syncAfterTransfer(transferClient, id)
      if (err) return new Response(JSON.stringify({ error: err, user: id }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true, transfer: true, users: ids.length }), { headers: { 'Content-Type': 'application/json' } })
  }

  const appUserId: string = ev.app_user_id ?? ''
  if (!UUID_RE.test(appUserId)) return new Response(JSON.stringify({ ignored: 'non-uuid app_user_id' }), { headers: { 'Content-Type': 'application/json' } })

  const entitlementIds: string[] = ev.entitlement_ids ?? (ev.entitlement_id ? [ev.entitlement_id] : [])
  const type: string = ev.type ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // ---- Personal "Halal Formosa Pro" entitlement -> mirror + referral reward ----
  if (entitlementIds.includes(PRO_ENTITLEMENT)) {
    if (type === 'EXPIRATION') {
      const { error } = await supabase.rpc('apply_pro_subscription', {
        p_user_id: appUserId, p_status: 'expired', p_source: 'revenuecat', p_expires_at: null,
      })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      const syncErr = await syncUserProStatus(supabase, appUserId, ev, false, false)
      if (syncErr) return new Response(JSON.stringify({ error: syncErr }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ ok: true, user: appUserId, pro_status: 'expired' }), { headers: { 'Content-Type': 'application/json' } })
    }

    // A CANCELLATION can mean either a normal non-renewal OR an actual refund.
    // RevenueCat's documented signal: cancel_reason === 'CUSTOMER_SUPPORT', or
    // (belt-and-suspenders, since refunds for non-latest periods don't always
    // set that reason) a negative price on the event. Refunded members are
    // excluded from milestone-campaign counts via pro_subscriptions.refunded_at.
    if (type === 'CANCELLATION') {
      const isRefund = ev.cancel_reason === 'CUSTOMER_SUPPORT'
        || (typeof ev.price === 'number' && ev.price < 0)
        || (typeof ev.price_in_purchased_currency === 'number' && ev.price_in_purchased_currency < 0)
      if (isRefund) {
        const { error } = await supabase.rpc('set_pro_subscription_refunded', { p_user_id: appUserId, p_refunded: true })
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
      // Refund revokes access now; a normal cancel keeps access until expiry (just stops renewing).
      const syncErr = await syncUserProStatus(supabase, appUserId, ev, !isRefund, false)
      if (syncErr) return new Response(JSON.stringify({ error: syncErr }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ ok: true, user: appUserId, cancellation: true, refund: isRefund }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (type === 'REFUND_REVERSED') {
      const { error } = await supabase.rpc('set_pro_subscription_refunded', { p_user_id: appUserId, p_refunded: false })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ ok: true, user: appUserId, refund_reversed: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (!ACTIVE.has(type)) return new Response(JSON.stringify({ ignored: `type ${type}` }), { headers: { 'Content-Type': 'application/json' } })

    const expiresAt: string | null = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null
    const { error: proError } = await supabase.rpc('apply_pro_subscription', {
      p_user_id: appUserId, p_status: 'active', p_source: 'revenuecat', p_expires_at: expiresAt,
    })
    if (proError) return new Response(JSON.stringify({ error: proError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    const syncErr = await syncUserProStatus(supabase, appUserId, ev, true, true)
    if (syncErr) return new Response(JSON.stringify({ error: syncErr }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    // Only actually does anything the first time this referred user's redemption
    // flips from 'signed_up' -> 'converted' — later renewals are no-ops server-side.
    const { data: conversion, error: convError } = await supabase.rpc('process_referral_conversion', {
      p_referred_user_id: appUserId, p_revenuecat_event_id: ev.id ?? null,
    })
    if (convError) return new Response(JSON.stringify({ error: convError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    if (conversion?.processed && conversion?.mode === 'free_days') {
      for (const reward of conversion.rewards ?? []) {
        if (reward.reward_type !== 'free_days') continue
        const grant = await grantPromotionalDays(reward.recipient_user_id, reward.days_granted ?? 0)
        await supabase.from('referral_rewards').update(
          grant.ok ? { status: 'granted' } : { status: 'failed', rc_grant_error: grant.error }
        ).eq('id', reward.id)
      }
    }

    // Milestone campaign payouts (free_days) are created inside Postgres by
    // auto_finalize_referral_campaigns() — which has no network access — so
    // this is the sweep that actually grants them via RevenueCat's API.
    // Piggybacks on any Pro-entitlement webhook event as a reasonable cadence
    // in lieu of a dedicated cron job.
    const { data: pendingGrants } = await supabase.rpc('claim_pending_milestone_grants')
    for (const reward of pendingGrants ?? []) {
      const grant = await grantPromotionalDays(reward.recipient_user_id, reward.days_granted ?? 0)
      await supabase.from('referral_rewards').update(
        grant.ok ? { status: 'granted' } : { status: 'failed', rc_grant_error: grant.error }
      ).eq('id', reward.id)
    }

    return new Response(JSON.stringify({ ok: true, user: appUserId, pro_status: 'active', referral: conversion }), { headers: { 'Content-Type': 'application/json' } })
  }

  // ---- Business tier (bronze/silver/gold), account-level, fans out to locations ----
  const idStr = [ev.product_id, ...entitlementIds].filter(Boolean).join(' ')
  const tier = tierFrom(idStr)
  if (!tier) return new Response(JSON.stringify({ ignored: 'not a business product' }), { headers: { 'Content-Type': 'application/json' } })

  let applyTier: string
  let expiresAt: string | null = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null
  if (type === 'EXPIRATION') { applyTier = 'free'; expiresAt = null }
  else if (ACTIVE.has(type)) { applyTier = tier }
  else return new Response(JSON.stringify({ ignored: `type ${type}` }), { headers: { 'Content-Type': 'application/json' } })

  const { error } = await supabase.rpc('apply_owner_business_tier', {
    p_user_id: appUserId, p_tier: applyTier, p_source: 'revenuecat', p_expires_at: expiresAt,
  })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  return new Response(JSON.stringify({ ok: true, user: appUserId, tier: applyTier }), { headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  const ctx: { type?: string; user?: string; product?: string } = {}
  let res: Response
  try {
    res = await handle(req, ctx)
  } catch (err) {
    res = new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  if (res.status >= 500) {
    // The database write failed: RevenueCat will retry, but a human should know.
    let errText = ''
    try { errText = (await res.clone().text()).slice(0, 300) } catch { /* ignore */ }
    await opsLog('error', 'event_failed', ctx.user ?? null, { type: ctx.type, product: ctx.product, status: res.status, error: errText })
    await alertOnce(`fail:${ctx.type ?? 'unknown'}`,
      `**🚨 RevenueCat webhook failed**\nEvent: ${ctx.type ?? 'unknown'}${ctx.user ? ` (user ${ctx.user.slice(0, 8)}…)` : ''}\nError: ${errText}\nRevenueCat will retry; the user's Pro status in Supabase may be stale until it succeeds (the daily reconcile job also repairs it).`)
  } else if (res.status === 200 && ctx.type) {
    let ok = false
    try { ok = (await res.clone().json())?.ok === true } catch { /* not JSON */ }
    await opsLog('info', ok ? 'event_processed' : 'event_ignored', ctx.user ?? null, { type: ctx.type, product: ctx.product })
  }
  return res
})
