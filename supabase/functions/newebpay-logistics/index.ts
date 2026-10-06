import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ============================================================
// ⚠️ SCAFFOLD — NOT VERIFIED AGAINST NEWEBPAY'S LOGISTICS SPEC
// ============================================================
// Newebpay gates their logistics (物流服務技術串接手冊) field-level API
// spec behind a merchant-portal login; it could not be fetched or
// corroborated in this session the way the MPG payment API was.
//
// This file mirrors ecpay-logistics/index.ts's action-based router shape
// (get_map_url / create_order / create_home_order / print_label) so the
// call sites and DB writes stay structurally parallel, and reuses the
// AES-256-CBC + SHA-256 signing scheme confirmed for Newebpay's MPG API
// (Newebpay uses the same HashKey/HashIV credential pattern across
// products) — but the actual field names below (LOGISTICS_ENDPOINT,
// request body keys, response parsing) are best-effort placeholders and
// WILL need correcting against the real manual before this can create a
// real shipment. Until then every action returns a clear "not verified"
// error instead of silently sending a malformed request to Newebpay.
//
// To finish this: get the 物流服務技術串接手冊 PDF from your Newebpay
// merchant dashboard, fill in NOT_VERIFIED sections below, test one order
// of each type (CVS + home delivery) against the sandbox, then remove the
// guard at the top of each handler.
// ============================================================

const NOT_VERIFIED_ERROR = 'Newebpay logistics field spec is unverified — see the warning banner at the top of this file. Confirm field names against your Newebpay logistics manual before enabling this action.'

const CVS_SUBTYPE_MAP: Record<string, string> = {
  '7eleven': 'UNIMARTC2C',
  'family_mart': 'FAMIC2C',
  'hi_life': 'HILIFEC2C',
  'ok_mart': 'OKMARTC2C',
}

function getConfig() {
  const mode = (Deno.env.get('NEWEBPAY_LOGISTICS_MODE') || 'sandbox').toLowerCase()
  const isProduction = mode === 'production'
  return {
    merchantId: Deno.env.get('NEWEBPAY_LOGISTICS_MERCHANT_ID') || '',
    hashKey: Deno.env.get('NEWEBPAY_LOGISTICS_HASH_KEY') || '',
    hashIV: Deno.env.get('NEWEBPAY_LOGISTICS_HASH_IV') || '',
    isProduction,
  }
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// ============================================================
// ACTION: get_map_url — Generate Newebpay CVS Map URL
// ============================================================
async function handleGetMapUrl(body: any) {
  const { deliveryMethod } = body
  if (!deliveryMethod) return jsonResponse({ error: 'deliveryMethod is required' }, 400)

  const subType = CVS_SUBTYPE_MAP[deliveryMethod]
  if (!subType) return jsonResponse({ error: `Invalid delivery method: ${deliveryMethod}` }, 400)

  // NOT_VERIFIED: Newebpay's CVS map-picker URL/param names are unconfirmed.
  return jsonResponse({ error: NOT_VERIFIED_ERROR }, 501)
}

// ============================================================
// ACTION: create_order — Create CVS logistics order at Newebpay
// ============================================================
async function handleCreateOrder(body: any) {
  const { orderId } = body
  if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

  // NOT_VERIFIED: request field names / endpoint for CVS shipment creation
  // are unconfirmed. See warning banner at top of file.
  return jsonResponse({ error: NOT_VERIFIED_ERROR }, 501)
}

// ============================================================
// ACTION: create_home_order — Create HOME delivery logistics order
// ============================================================
async function handleCreateHomeOrder(body: any) {
  const { orderId } = body
  if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

  // NOT_VERIFIED: request field names / endpoint for home-delivery shipment
  // creation are unconfirmed. See warning banner at top of file.
  return jsonResponse({ error: NOT_VERIFIED_ERROR }, 501)
}

// ============================================================
// ACTION: print_label — Get print label URL
// ============================================================
async function handlePrintLabel(body: any) {
  const { orderId } = body
  if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

  // NOT_VERIFIED: print-label endpoint/params are unconfirmed.
  return jsonResponse({ error: NOT_VERIFIED_ERROR }, 501)
}

// ============================================================
// Main Router
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const url = new URL(req.url)
    const actionParam = url.searchParams.get('action')

    if (actionParam === 'map_callback') {
      // NOT_VERIFIED: Newebpay's map-picker callback payload shape is unconfirmed.
      return jsonResponse({ error: NOT_VERIFIED_ERROR }, 501)
    }

    const body = await req.json()
    const action = body.action || actionParam

    switch (action) {
      case 'get_map_url':
        return await handleGetMapUrl(body)
      case 'create_order':
        return await handleCreateOrder(body)
      case 'create_home_order':
        return await handleCreateHomeOrder(body)
      case 'print_label':
        return await handlePrintLabel(body)
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err: any) {
    console.error('[NEWEBPAY-LOGISTICS] Fatal error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
})
