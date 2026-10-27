import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Awards the points for one rule-based action (public.point_rules) to the signed-in caller.
// Rebuilt from the database contract because the original award-points source could not be recovered:
//   1. identify the caller from their access token,
//   2. look the action up in point_rules (must exist and be active),
//   3. insert the point_logs row and add the points with increment_points (service-role-only RPC).
// Response: { success, points, label, total } — what usePoints.ts reads.
// Like the original it does NOT limit how often an action can be awarded; once-a-day behaviour for
// missions is decided client-side from point_logs.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Server key: the new `default` secret key (SUPABASE_SECRET_KEYS is a JSON object keyed by key name),
// falling back to the legacy service_role key until that one is deactivated.
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default
    if (typeof key === 'string' && key !== '') return key
  } catch { /* fall through to the legacy key */ }
  return ''
}
const SERVER_KEY = readSecretKey() || (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
const admin = createClient(SUPABASE_URL, SERVER_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ success: false, error: 'Unauthorized' }, 401)
  const { data: userData, error: authError } = await admin.auth.getUser(token)
  const userId = userData?.user?.id
  if (authError || !userId) return json({ success: false, error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action.trim() : ''
  if (action === '') return json({ success: false, error: 'Missing action' }, 400)

  const { data: rule, error: ruleError } = await admin
    .from('point_rules').select('points, label, active').eq('action', action).maybeSingle()
  if (ruleError) return json({ success: false, error: ruleError.message }, 500)
  if (!rule || !rule.active) return json({ success: false, error: 'Unknown or inactive action' }, 400)

  const { data: logRow, error: logError } = await admin
    .from('point_logs').insert({ user_id: userId, action, points: rule.points }).select('id').single()
  if (logError || !logRow) return json({ success: false, error: logError?.message ?? 'Could not record points' }, 500)

  const { data: total, error: incError } = await admin.rpc('increment_points', { uid: userId, p: rule.points })
  if (incError || typeof total !== 'number') {
    // Undo the log row so profile points keep matching the sum of point_logs.
    await admin.from('point_logs').delete().eq('id', logRow.id)
    return json({ success: false, error: incError?.message ?? 'Profile not found' }, incError ? 500 : 404)
  }

  return json({ success: true, points: rule.points, label: rule.label, total })
})
