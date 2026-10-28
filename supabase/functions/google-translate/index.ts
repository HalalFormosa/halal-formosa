// supabase/functions/google-translate/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MAX_TEXT_CHARS = 5000; // an ingredient label is a few hundred characters
const TARGETS = new Set(["en", "id", "zh-TW", "zh-CN", "ar", "ms"]);

Deno.serve(async (req) => {
  const requestHeaders = req.headers.get("Access-Control-Request-Headers");
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders || "authorization, x-client-info, apikey, content-type, x-csrf-token, x-recaptcha-token, x-app-client",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: { text?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Missing text" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_CHARS) : "";
  if (!text.trim()) return json({ error: "Missing text" }, 400);
  const target = typeof body.target === "string" && TARGETS.has(body.target) ? body.target : "en";

  const apiKey = Deno.env.get("GOOGLE_TRANSLATION_API_KEY");
  if (!apiKey) {
    console.error("GOOGLE_TRANSLATION_API_KEY secret is not set");
    return json({ error: "Translation is temporarily unavailable." }, 503);
  }

  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target, format: "text" }),
    });
    const data = await res.json();
    if (data.error) {
      // Real reason stays in the logs; callers only see a generic message.
      console.error("Google Translate error", data.error.code, data.error.message);
      return json({ error: "Translation is temporarily unavailable." }, 503);
    }
    return json({ translatedText: data.data?.translations?.[0]?.translatedText || "" });
  } catch (err) {
    console.error("google-translate failed:", err);
    return json({ error: "Translation is temporarily unavailable." }, 503);
  }
});
