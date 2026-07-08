import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// RevenueCat webhook -> sets the owner's business tier (account-level), which
// fans out to all their claimed locations. Auth: RevenueCat 'Authorization'
// header must equal REVENUECAT_WEBHOOK_SECRET.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIVE = new Set(['INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','UNCANCELLATION','NON_RENEWING_PURCHASE','SUBSCRIPTION_EXTENDED'])

function tierFrom(str: string): 'bronze' | 'silver' | 'gold' | null {
  const s = str.toLowerCase()
  if (s.includes('gold')) return 'gold'
  if (s.includes('silver')) return 'silver'
  if (s.includes('bronze')) return 'bronze'
  return null
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('authorization') ?? ''
  if (WEBHOOK_SECRET === '' || auth !== WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 })

  let body: any
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const ev = body?.event
  if (!ev) return new Response(JSON.stringify({ ignored: 'no event' }), { headers: { 'Content-Type': 'application/json' } })

  const appUserId: string = ev.app_user_id ?? ''
  if (!UUID_RE.test(appUserId)) return new Response(JSON.stringify({ ignored: 'non-uuid app_user_id' }), { headers: { 'Content-Type': 'application/json' } })

  const idStr = [ev.product_id, ...(ev.entitlement_ids ?? []), ev.entitlement_id].filter(Boolean).join(' ')
  const tier = tierFrom(idStr)
  if (!tier) return new Response(JSON.stringify({ ignored: 'not a business product' }), { headers: { 'Content-Type': 'application/json' } })

  const type: string = ev.type ?? ''
  let applyTier: string
  let expiresAt: string | null = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null
  if (type === 'EXPIRATION') { applyTier = 'free'; expiresAt = null }
  else if (ACTIVE.has(type)) { applyTier = tier }
  else return new Response(JSON.stringify({ ignored: `type ${type}` }), { headers: { 'Content-Type': 'application/json' } })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { error } = await supabase.rpc('apply_owner_business_tier', {
    p_user_id: appUserId, p_tier: applyTier, p_source: 'revenuecat', p_expires_at: expiresAt,
  })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  return new Response(JSON.stringify({ ok: true, user: appUserId, tier: applyTier }), { headers: { 'Content-Type': 'application/json' } })
})
