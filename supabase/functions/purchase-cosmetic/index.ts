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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // 🔒 Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // 📨 Parse body
    const { cosmetic_id } = await req.json();
    if (!cosmetic_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing cosmetic_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // 🎯 Call RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "purchase_cosmetic_rpc",
      { uid: user.id, cid: cosmetic_id }
    );

    if (rpcError) {
      console.error("❌ RPC purchase error:", rpcError);
      return new Response(JSON.stringify({ success: false, error: "Purchase failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (!rpcResult || rpcResult.success === false) {
      return new Response(JSON.stringify({ success: false, error: rpcResult?.error || "Purchase failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: rpcResult.new_balance,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      }
    );
  } catch (err) {
    console.error("🔥 Purchase cosmetic fatal error:", err);
    return new Response(JSON.stringify({ success: false, error: "Purchase failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
});