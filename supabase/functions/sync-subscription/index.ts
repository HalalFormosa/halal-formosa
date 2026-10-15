import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mirrors the caller's own Pro entitlement into user_subscriptions + user_profiles.is_donor/donor_type.
// The client-supplied body is IGNORED: the caller's identity comes from their verified JWT and the
// entitlement state comes from RevenueCat's REST API (secret key), so a forged customerInfo payload
// cannot grant Pro. Never downgrades a user RevenueCat has no record of (manual grants stay untouched).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RC_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? ''

const PRO_ENTITLEMENT = 'Halal Formosa Pro'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: authError } = await admin.auth.getUser(token)
  const userId = userData?.user?.id
  if (authError || !userId) return json({ error: 'Unauthorized' }, 401)

  if (RC_SECRET_API_KEY === '') return json({ error: 'REVENUECAT_SECRET_KEY not configured' }, 500)

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { 'Authorization': `Bearer ${RC_SECRET_API_KEY}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    console.error('[sync-subscription] RC', res.status)
    return json({ error: `RevenueCat lookup failed (${res.status})` }, 502)
  }

  const sub = (await res.json())?.subscriber ?? {}
  const ent = sub.entitlements?.[PRO_ENTITLEMENT]
  const subs = sub.subscriptions ?? {}
  const known = Boolean(ent) || Object.keys(subs).length > 0 || Object.keys(sub.non_subscriptions ?? {}).length > 0
  if (!known) return json({ ok: true, synced: false, reason: 'unknown_to_revenuecat' })

  const now = Date.now()
  const expiresMs = ent?.expires_date ? Date.parse(ent.expires_date) : null
  const graceMs = ent?.grace_period_expires_date ? Date.parse(ent.grace_period_expires_date) : null
  const active = Boolean(ent) && (expiresMs === null || expiresMs > now || (graceMs !== null && graceMs > now))

  const productId: string | null = ent?.product_identifier ?? null
  const productSub = productId ? subs[productId] : null

  const { error } = await admin.rpc('sync_user_pro_status', {
    p_user_id: userId,
    p_active: active,
    p_expires_at: ent?.expires_date ?? null,
    p_will_renew: active && productSub ? !productSub.unsubscribe_detected_at : false,
    p_first_purchase_at: productSub?.original_purchase_date ?? ent?.purchase_date ?? null,
    p_product_id: productId,
    p_revenuecat_user_id: null,
  })
  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, synced: true, active })
})
