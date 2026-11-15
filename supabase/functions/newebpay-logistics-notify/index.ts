import { serve } from "https://deno.land/std/http/server.ts"

// ⚠️ SCAFFOLD — see the warning banner in supabase/functions/newebpay-logistics/index.ts.
// Newebpay's async shipment-status notify payload shape (field names, signing)
// is unconfirmed. This stub logs whatever it receives and acknowledges so
// Newebpay doesn't retry, but does NOT update store_orders yet — wire this up
// once handleCreateOrder/handleCreateHomeOrder in newebpay-logistics are verified
// and you know what this callback actually looks like.

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const formData = await req.formData().catch(() => null)
    if (formData) {
      const allParams: Record<string, string> = {}
      formData.forEach((value, key) => { allParams[key] = String(value) })
      console.log('[NEWEBPAY-LOGISTICS-NOTIFY] Received (unverified shape):', JSON.stringify(allParams))
    } else {
      const text = await req.text()
      console.log('[NEWEBPAY-LOGISTICS-NOTIFY] Received non-form body (unverified shape):', text)
    }

    console.warn('[NEWEBPAY-LOGISTICS-NOTIFY] Not wired to store_orders yet — see warning banner in newebpay-logistics/index.ts')
    return new Response('1|OK')
  } catch (err: any) {
    console.error('[NEWEBPAY-LOGISTICS-NOTIFY] Fatal:', err)
    return new Response('0|Internal Error')
  }
})
