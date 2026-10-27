import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Server key: the new `default` secret key (SUPABASE_SECRET_KEYS is a JSON object keyed by key name),
// falling back to the legacy service_role key until that one is deactivated.
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (typeof key === "string" && key !== "") return key;
  } catch { /* fall through to the legacy key */ }
  return "";
}
const SECRET_KEY = readSecretKey();

// ============================================================
// klook-create-order
//
// Places a booking for a Klook-sourced trip via Klook's B2B Open API
// (Solution Partner API) instead of redirecting the user to Klook's
// site. The whole checkout stays inside the Halal Formosa app.
//
// Flow: TripCheckoutView.vue -> invokeFunction('klook-create-order')
//   1. Verify the caller's JWT.
//   2. Load the trip + its klook_product_bindings row.
//   3. Insert a `klook_bookings` row (status='pending').
//   4. Call Klook's Open API to actually place the order.
//   5. Update the `klook_bookings` row with the result and respond.
//
// ⚠️ callKlookOpenApi() below is a scaffold, not a verified
// integration. Klook's partner API surface (Content API / Booking API
// / Open API v3, endpoint paths, header names, signing scheme, and
// exact request/response fields) varies by contract tier, and I don't
// have your Klook Solution Partner docs or credentials to confirm the
// exact shape. Fill in ENDPOINT + the request/response mapping from
// your actual Klook API reference before relying on this in
// production — everything else (auth, DB bookkeeping, error handling,
// idempotency) is wired up and ready.
// ============================================================

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  SECRET_KEY || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

interface KlookOrderResult {
  ok: boolean;
  klookOrderNo?: string;
  klookBookingRef?: string;
  raw: unknown;
  errorMessage?: string;
}

/**
 * Calls Klook's B2B Open API to actually place the booking.
 *
 * TODO before going live: replace ENDPOINT and the request/response
 * field mapping with what your Klook Open API / Solution Partner
 * contract docs specify. The signing scheme below follows Klook's
 * commonly documented HMAC-SHA256 pattern (timestamp + nonce + secret)
 * but you MUST verify the exact header names against your docs.
 */
async function callKlookOpenApi(params: {
  activityId: string;
  packageId: string;
  unitCount: number;
  travelDate: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
}): Promise<KlookOrderResult> {
  const apiKey = Deno.env.get("KLOOK_API_KEY");
  const apiSecret = Deno.env.get("KLOOK_API_SECRET");
  const baseUrl = Deno.env.get("KLOOK_API_BASE_URL") || "https://sandbox-api.klook.com";

  if (!apiKey || !apiSecret) {
    return {
      ok: false,
      raw: null,
      errorMessage: "Klook API credentials are not configured (set KLOOK_API_KEY / KLOOK_API_SECRET / KLOOK_API_BASE_URL as edge function secrets).",
    };
  }

  const ENDPOINT = "/v3/usg/order/create"; // TODO: confirm against Klook's Open API reference

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();

  const body = {
    activity_id: params.activityId,
    package_id: params.packageId,
    unit_count: params.unitCount,
    travel_date: params.travelDate,
    contact: {
      name: params.buyerName,
      email: params.buyerEmail,
      phone: params.buyerPhone,
    },
  };

  const bodyString = JSON.stringify(body);
  const signaturePayload = `${apiKey}${timestamp}${nonce}${bodyString}`;
  const signature = await hmacSha256Hex(signaturePayload, apiSecret);

  try {
    const res = await fetch(`${baseUrl}${ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Klk-Api-Key": apiKey,
        "Klk-Timestamp": timestamp,
        "Klk-Nonce": nonce,
        "Klk-Signature": signature,
      },
      body: bodyString,
    });

    const raw = await res.json().catch(() => null);

    if (!res.ok) {
      return { ok: false, raw, errorMessage: raw?.error?.message || `Klook API returned ${res.status}` };
    }

    return {
      ok: true,
      raw,
      klookOrderNo: raw?.result?.order_no ?? raw?.order_no,
      klookBookingRef: raw?.result?.booking_ref ?? raw?.confirmation_no,
    };
  } catch (err) {
    return { ok: false, raw: null, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // 🔒 Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    // 📨 Parse body
    const { tripId, packageId, unitCount, travelDate, buyerName, buyerEmail, buyerPhone } = await req.json();

    if (!tripId) {
      return jsonResponse({ success: false, error: "Missing tripId" }, 400);
    }

    // Load the trip + its Klook binding
    const { data: trip, error: tripErr } = await supabaseAdmin
      .from("trips")
      .select("id, booking_mode, klook_product_bindings ( klook_activity_id, klook_package_id, integration_mode )")
      .eq("id", tripId)
      .single();

    if (tripErr || !trip) {
      return jsonResponse({ success: false, error: "Trip not found" }, 404);
    }

    const binding = Array.isArray(trip.klook_product_bindings)
      ? trip.klook_product_bindings[0]
      : trip.klook_product_bindings;

    if (trip.booking_mode !== "klook_b2b" || !binding) {
      return jsonResponse({ success: false, error: "This trip is not set up for in-app Klook booking" }, 400);
    }

    const resolvedPackageId = packageId || binding.klook_package_id;
    if (!resolvedPackageId) {
      return jsonResponse({ success: false, error: "Missing packageId" }, 400);
    }

    // 📝 Record the attempt before calling out to Klook
    const { data: booking, error: insertErr } = await supabaseAdmin
      .from("klook_bookings")
      .insert({
        user_id: user.id,
        trip_id: tripId,
        klook_package_id: resolvedPackageId,
        klook_activity_id: binding.klook_activity_id,
        unit_count: unitCount || 1,
        travel_date: travelDate || null,
        buyer_name: buyerName || null,
        buyer_email: buyerEmail || null,
        buyer_phone: buyerPhone || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr || !booking) {
      console.error("[KLOOK-CREATE-ORDER] Failed to create booking record:", insertErr);
      return jsonResponse({ success: false, error: "Failed to create booking record" }, 500);
    }

    // 🌐 Call Klook's B2B Open API
    const result = await callKlookOpenApi({
      activityId: binding.klook_activity_id,
      packageId: resolvedPackageId,
      unitCount: unitCount || 1,
      travelDate: travelDate || null,
      buyerName: buyerName || null,
      buyerEmail: buyerEmail || null,
      buyerPhone: buyerPhone || null,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("klook_bookings")
        .update({
          status: "failed",
          failure_reason: result.errorMessage,
          klook_raw_response: result.raw,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      console.error("[KLOOK-CREATE-ORDER] Klook API call failed:", result.errorMessage);
      return jsonResponse({ success: false, error: result.errorMessage || "Klook booking failed", bookingId: booking.id }, 502);
    }

    await supabaseAdmin
      .from("klook_bookings")
      .update({
        status: "confirmed",
        klook_order_no: result.klookOrderNo,
        klook_booking_ref: result.klookBookingRef,
        klook_raw_response: result.raw,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    return jsonResponse({
      success: true,
      bookingId: booking.id,
      status: "confirmed",
      klookOrderNo: result.klookOrderNo,
      klookBookingRef: result.klookBookingRef,
    });
  } catch (err) {
    console.error("[KLOOK-CREATE-ORDER] Fatal error:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
