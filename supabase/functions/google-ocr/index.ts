// supabase/functions/google-ocr/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
console.info("🚀 google-ocr function deployed");

// ------------------ Caller authentication ------------------
// This function spends money (Google Vision + Translate), so callers must be the server itself
// (service role key, e.g. analyze-product) or a signed-in user (their access token).
// The public anon key alone is NOT enough. Enforcement is switched on/off with app_config.enforce_ocr_auth
// ('true' / 'false') so it can be enabled once every supported app build sends the user's token.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!);
const MAX_IMAGE_BASE64_CHARS = 12_000_000; // ~9 MB of image data; Vision rejects anything over 10 MB anyway

async function isAuthorizedCaller(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  if (SERVICE_ROLE && token === SERVICE_ROLE) return true;
  try {
    const { data, error } = await admin.auth.getUser(token); // fails for the anon key (no user)
    return !error && !!data?.user;
  } catch {
    return false;
  }
}

let enforceCache = { value: false, at: 0 };
async function authEnforced(): Promise<boolean> {
  if (Date.now() - enforceCache.at < 10_000) return enforceCache.value;
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "enforce_ocr_auth").maybeSingle();
    enforceCache = { value: String(data?.value ?? "false").toLowerCase() === "true", at: Date.now() };
  } catch {
    enforceCache = { value: enforceCache.value, at: Date.now() }; // keep last known value on DB errors
  }
  return enforceCache.value;
}

// ------------------ Helpers ------------------
// Convert PEM private key -> DER (Uint8Array)
function pemToDer(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(base64), (c)=>c.charCodeAt(0));
}
// Base64url encoding
function base64url(input: string | Uint8Array) {
  const bin = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Create Google OAuth2 access token
async function getAccessToken() {
  const clientEmail = Deno.env.get("GCP_CLIENT_EMAIL");
  const privateKey = Deno.env.get("GCP_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  console.log("🔑 GCP_CLIENT_EMAIL present:", !!clientEmail);
  console.log("🔑 GCP_PRIVATE_KEY present:", !!privateKey);
  if (!clientEmail || !privateKey) {
    throw new Error("Missing GCP_CLIENT_EMAIL or GCP_PRIVATE_KEY");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const jwtHeader = base64url(JSON.stringify(header));
  const jwtClaim = base64url(JSON.stringify(claim));
  const toSign = `${jwtHeader}.${jwtClaim}`;
  const keyData = pemToDer(privateKey);
  const key = await crypto.subtle.importKey("pkcs8", keyData, {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const signature = base64url(new Uint8Array(sigBuf));
  const jwt = `${toSign}.${signature}`;
  console.log("🪪 JWT built, requesting Google OAuth token…");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const json = await res.json();
  console.log("📡 Google OAuth response:", res.status, res.statusText, json);
  if (!json.access_token) {
    throw new Error("Failed to fetch access token");
  }
  return json.access_token;
}

async function translateText(text: string, target: string = "en") {
  const apiKey = Deno.env.get("GOOGLE_TRANSLATION_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GOOGLE_TRANSLATION_API_KEY secret");
  }
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: text,
      target: target,
      format: "text"
    })
  });
  const json = await res.json();
  if (json.error) {
    console.error("❌ Translation API error:", json.error);
    return "";
  }
  return json.data?.translations?.[0]?.translatedText || "";
}

// ------------------ Main ------------------
Deno.serve(async (req)=>{
  const requestHeaders = req.headers.get("Access-Control-Request-Headers");
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders || "authorization, x-client-info, apikey, content-type, x-api-key, x-csrf-token, x-recaptcha-token, x-app-client"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    console.log("📥 Incoming request:", req.method, req.url);
    // ✅ Optional secret check (set GOOGLE_OCR_KEY in project env)
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("GOOGLE_OCR_KEY");
    if (expectedKey && apiKey !== expectedKey) {
      console.warn("❌ Invalid or missing X-API-KEY");
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Caller must be the server or a signed-in user (see top of file).
    if (!(await isAuthorizedCaller(req))) {
      if (await authEnforced()) {
        console.warn("⛔ google-ocr: rejected caller without a valid user/service token");
        return new Response(JSON.stringify({
          error: "Unauthorized"
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      console.warn("⚠️ google-ocr: unauthenticated call allowed (enforcement off)");
    }
    // Parse body
    const { imageBase64, translate = false } = await req.json();
    if (typeof imageBase64 === "string" && imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return new Response(JSON.stringify({
        error: "Image too large"
      }), {
        status: 413,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    if (!imageBase64) {
      return new Response(JSON.stringify({
        error: "Missing imageBase64"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log("🖼️ Image received (length):", imageBase64.length, "Translate:", translate);
    // Get Google Vision access token
    const token = await getAccessToken();
    // Call Vision API
    const visionRes = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageBase64
            },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION"
              }
            ]
          }
        ]
      })
    });
    console.log("📡 Vision API response:", visionRes.status, visionRes.statusText);
    const result = await visionRes.json();
    console.log("📦 Vision API JSON keys:", Object.keys(result));
    const response = result?.responses?.[0];
    const text = response?.fullTextAnnotation?.text ?? response?.textAnnotations?.[0]?.description ?? "";
    const words = [];
    if (response?.fullTextAnnotation?.pages) {
      for (const page of response.fullTextAnnotation.pages){
        for (const block of page.blocks || []){
          for (const paragraph of block.paragraphs || []){
            for (const word of paragraph.words || []){
              const description = (word.symbols || []).map((s: any)=>s.text).join("");
              const vertices = word.boundingBox?.vertices?.map((v: any)=>({
                  x: v.x || 0,
                  y: v.y || 0
                })) || [];
              words.push({
                description,
                vertices
              });
            }
          }
        }
      }
    }
    console.log("✅ OCR extracted text length:", text.length);

    let translatedText = "";
    if (translate && text.trim()) {
      console.log("🌍 Translating text...");
      translatedText = await translateText(text);
      console.log("✅ Translation complete.");
    }

    return new Response(JSON.stringify({
      text,
      translatedText,
      words
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (err) {
    console.error("❌ google-ocr error:", err);
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});
