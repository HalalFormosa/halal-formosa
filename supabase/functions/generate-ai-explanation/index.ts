import { createClient } from "npm:@supabase/supabase-js@2";

// Server key: the new `default` secret key (SUPABASE_SECRET_KEYS is a JSON object keyed by key name),
// falling back to the legacy service_role key until that one is deactivated.
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (typeof key === "string" && key !== "") return key;
  } catch { /* fall through to the legacy key */ }
  return "";
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  readSecretKey() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gemini-3.1-flash-lite";
const DAILY_LIMIT = 20; // per user per Taipei day (real use is ~2 a day at most)
const MAX_INGREDIENTS_CHARS = 3000;
const MAX_HIGHLIGHT_CHARS = 3000;

// `error` is always a plain English sentence so older app builds, which print it as-is, stay readable.
const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please sign in to use AI explanations.",
  PRO_ONLY: "AI explanations are a Pro feature.",
  AI_DAILY_LIMIT: "You've reached today's AI explanation limit. It resets tomorrow.",
  AI_UNAVAILABLE: "AI explanation is temporarily unavailable. Please try again later.",
  BAD_REQUEST: "Missing ingredients text.",
};

function fail(status: number, code: keyof typeof MESSAGES) {
  return new Response(JSON.stringify({ error: MESSAGES[code], code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isPro(userId: string): Promise<boolean> {
  const [profile, sub, roles] = await Promise.all([
    supabaseAdmin.from("user_profiles").select("is_donor").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_subscriptions").select("entitlement_active").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return profile.data?.is_donor === true ||
    sub.data?.entitlement_active === true ||
    (roles.data ?? []).some((r: { role: string }) => r.role === "admin");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // 1. Only a signed-in user. The public anon key (what guests send) is rejected here.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail(401, "UNAUTHORIZED");
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return fail(401, "UNAUTHORIZED");

  // 2. Pro (or admin) only. The app already gates the button; this makes the server enforce it.
  if (!(await isPro(user.id))) return fail(403, "PRO_ONLY");

  // 3. Validate input before spending quota.
  let body: { ingredientsText?: unknown; highlightInfo?: unknown; systemStatus?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, "BAD_REQUEST");
  }
  const ingredientsText = typeof body.ingredientsText === "string" ? body.ingredientsText.slice(0, MAX_INGREDIENTS_CHARS) : "";
  const highlightInfo = typeof body.highlightInfo === "string" ? body.highlightInfo.slice(0, MAX_HIGHLIGHT_CHARS) : "None";
  const systemStatus = typeof body.systemStatus === "string" ? body.systemStatus.slice(0, 40) : "";
  if (!ingredientsText.trim()) return fail(400, "BAD_REQUEST");

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not configured in Supabase Secrets");
    return fail(503, "AI_UNAVAILABLE");
  }

  // 4. Daily per-user quota. If the quota store itself fails, let the request through (and log it)
  //    rather than break a paying user; auth + Pro checks above already block outsiders.
  let consumed = false;
  const { data: quota, error: quotaError } = await supabaseAdmin.rpc("consume_ai_explanation_quota", {
    p_user: user.id,
    p_limit: DAILY_LIMIT,
  });
  if (quotaError) {
    console.error("quota rpc failed:", quotaError.message);
  } else {
    const row = Array.isArray(quota) ? quota[0] : quota;
    if (row && row.ok === false) return fail(429, "AI_DAILY_LIMIT");
    consumed = true;
  }

  const refund = async () => {
    if (!consumed) return;
    const { error } = await supabaseAdmin.rpc("refund_ai_explanation_quota", { p_user: user.id });
    if (error) console.error("quota refund failed:", error.message);
  };

  try {
    const prompt = `You are providing official explanations for Halal Formosa.
Your goal is to explain WHY specific ingredients are flagged as Haram or Syubhah based ONLY on the data provided below.

1. **Trusted ingredient status (EXCLUSIVELY use this for status)**:
${highlightInfo}

2. **Ingredients (OCR result for context ONLY)**:
${ingredientsText}

STRICT INSTRUCTIONS:
- **NO HALLUCINATIONS**: Only explain ingredients that appear in the "Trusted ingredient status" list above.
- **STRICT DATA ADHERENCE**: If an ingredient is NOT in the "Trusted ingredient status" list, do NOT mention it, even if you see it in the OCR text.
- **STATUS AUTHORITY**: Do NOT use your own knowledge to determine if an ingredient is Halal or Haram. Use ONLY the status provided in the list. For example, if "Sugar" is in the OCR but NOT in the Trusted list, do NOT explain it.
- **Structure**:
  1. **Summary Sentence**: Start with one sentence listing all "Muslim-friendly" ingredients found in the Trusted list.
  2. **Risk Analysis**: For every ingredient labeled as **Haram** or **Syubhah** in the Trusted list, create a bullet point ("- ") explaining the specific risk (e.g., animal origin, alcohol content).
  3. **Conclusion**: Always end with: "Based on our Halal Formosa ingredients database, this product is ${systemStatus}."

Use Markdown (**bold** names, *italic* statuses).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!response.ok || !response.body) {
      // Log the real reason server-side only; never show Google's billing/quota text to users.
      const detail = await response.text().catch(() => "");
      console.error("Gemini error", response.status, detail.slice(0, 300));
      await refund();
      return fail(503, "AI_UNAVAILABLE");
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (text) {
                  const openAiChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
                  await writer.write(encoder.encode(openAiChunk));
                }
              } catch (_e) {
                // partial JSON segment, ignored like before
              }
            }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("Streaming error:", err);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Model-Used": MODEL,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("generate-ai-explanation failed:", err);
    await refund();
    return fail(503, "AI_UNAVAILABLE");
  }
});
