import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Exchanges a LINE Login authorization code for a Supabase session.
//
// Supabase has no built-in LINE provider, so this function does the OAuth
// code exchange + id_token verification itself, then mints a one-time
// magic-link token for the matching Supabase user (creating one on first
// login). The client redeems that token with supabase.auth.verifyOtp().
//
// Accounts are matched by email when LINE provides a verified one (LINE only
// returns `email` in the id_token when the user granted the email scope and
// LINE has verified it), so a LINE login can transparently attach to an
// existing Google/password account sharing that email. Users without a LINE
// email get a synthetic placeholder address instead.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_CHANNEL_ID = Deno.env.get('LINE_LOGIN_CHANNEL_ID')!
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_LOGIN_CHANNEL_SECRET')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface LineVerifyResponse {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  nonce?: string
  name?: string
  picture?: string
  email?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }

  const code: string = body?.code ?? ''
  const redirectUri: string = body?.redirectUri ?? ''
  const nonce: string | undefined = body?.nonce
  if (!code || !redirectUri) return json({ error: 'Missing code or redirectUri' }, 400)

  // 1. Exchange the authorization code for tokens.
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET,
    }),
  })
  if (!tokenRes.ok) {
    return json({ error: 'LINE token exchange failed', detail: await tokenRes.text() }, 401)
  }
  const tokenData = await tokenRes.json()
  const idToken: string | undefined = tokenData.id_token
  if (!idToken) return json({ error: 'LINE did not return an id_token' }, 401)

  // 2. Verify the id_token with LINE (validates signature, audience, expiry).
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL_ID }),
  })
  if (!verifyRes.ok) {
    return json({ error: 'LINE id_token verification failed', detail: await verifyRes.text() }, 401)
  }
  const profile: LineVerifyResponse = await verifyRes.json()

  if (nonce && profile.nonce !== nonce) {
    return json({ error: 'Nonce mismatch' }, 401)
  }

  const lineUserId = profile.sub
  if (!lineUserId) return json({ error: 'LINE profile missing sub' }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 3. Reuse the email on file for a returning LINE identity so account
  // continuity doesn't depend on LINE re-reporting the same email.
  const { data: existingIdentity } = await supabase
    .from('line_identities')
    .select('email')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  const email = existingIdentity?.email
    ?? profile.email
    ?? `line-${lineUserId}@line.halalformosa.internal`

  // 4. generateLink creates the auth user on first login and, either way,
  // returns a single-use token the client redeems with verifyOtp.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      data: {
        full_name: profile.name,
        avatar_url: profile.picture,
        line_user_id: lineUserId,
      },
    },
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    return json({ error: linkError?.message ?? 'Failed to create session token' }, 500)
  }

  const userId = linkData.user.id

  const { error: upsertError } = await supabase
    .from('line_identities')
    .upsert({
      line_user_id: lineUserId,
      user_id: userId,
      email,
      display_name: profile.name ?? null,
      avatar_url: profile.picture ?? null,
    }, { onConflict: 'line_user_id' })
  if (upsertError) return json({ error: upsertError.message }, 500)

  return json({ email, token_hash: linkData.properties.hashed_token })
})
