// supabase/functions/analyze-product/index.ts
// Server-only: called by line-webhook with the service role key. It fans out to paid Google APIs
// (Vision OCR + Translate), so it must never be callable anonymously.
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_TRANSLATION_API_KEY");
const OCR_KEY = Deno.env.get("GOOGLE_OCR_KEY"); // optional shared secret
const MAX_IMAGE_BYTES = 8_000_000;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
/* ---------- Helpers ---------- */ function cleanChineseOcrText(text) {
  let cleaned = text.replace(/\r?\n+/g, ", ").replace(/[。、．。]/g, ",").replace(/\s{2,}/g, " ").replace(/品\s*,?\s*名/gi, "品名").replace(/成\s*,?\s*分/gi, "成分");
  cleaned = cleaned.replace(/(成分|配料|原料|材料|内容物|內容物)[:：]/gi, "Ingredients: ");
  cleaned = cleaned.replace(/品名[:：]/gi, "Product name: ");
  cleaned = cleaned.replace(/,\s*,+/g, ", ").replace(/^,|,$/g, "");
  return cleaned.trim();
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for(let i = 0; i < bytes.length; i += chunkSize){
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
function extractProductName(text) {
  const normalized = text.replace(/：/g, ":").replace(/　/g, " ").replace(/\s+/g, " ").trim();
  const clean = (s)=>s.replace(/[™®©]+/g, "").replace(/\*+$/g, "").trim();
  const m1 = /(product\s*name|product|name|item|品名|品項)\s*:?(.+?)(?=\s*(ingredients?\s*:|$|[.;\n\r]))/i.exec(normalized);
  if (m1?.[2]) {
    const candidate = clean(m1[2]);
    if (candidate.length > 1) return candidate;
  }
  const lower = normalized.toLowerCase();
  for (const keyword of [
    "product name",
    "name:",
    "item:",
    "品名",
    "品項"
  ]){
    const idx = lower.indexOf(keyword);
    if (idx !== -1) {
      let remainder = normalized.substring(idx + keyword.length).trim();
      remainder = remainder.split(/ingredients?:/i)[0].split(/[,(\n]/)[0].replace(/[:：]/g, "").trim();
      if (remainder.length > 1) return clean(remainder);
    }
  }
  return "";
}
// --- Matching ---
function normalizeIngredientForMatch(ing) {
  return ing.replace(/\(.*?\)/g, "").trim().toLowerCase();
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchIngredient(ing, keyword) {
  const normIng = normalizeIngredientForMatch(ing);
  const normKey = keyword.toLowerCase().trim();
  if (!normIng || !normKey) return false;
  if (normIng === normKey) return true; // exact
  const regex = new RegExp(`\\b${escapeRegex(normKey)}\\b`, "i");
  if (regex.test(normIng)) return true;
  return false;
}
// resolve conflicts → prefer longer friendly matches over shorter doubtful
function resolveConflicts(matches) {
  const final = [];
  for (const m of matches){
    const longerFriendly = matches.find((other)=>other.ing === m.ing && other.color.includes("primary") && other.keyword.length > m.keyword.length);
    if (longerFriendly && !m.color.includes("danger")) {
      continue;
    }
    final.push(m);
  }
  return final;
}
function formatReason(label, items) {
  return `${label}:\n- ${[
    ...new Set(items)
  ].join("\n- ")}`;
}
/* ---------- Main ---------- */ serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Only POST allowed"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 405
      });
    }
    // Server-only: the caller must present the service role key.
    const authHeader = req.headers.get("authorization") ?? "";
    if (!SERVICE_ROLE || authHeader !== `Bearer ${SERVICE_ROLE}`) {
      console.warn("⛔ analyze-product: rejected unauthenticated call");
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 401
      });
    }
    // OCR
    const blob = await req.blob();
    if (blob.size > MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({
        error: "Image too large"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 413
      });
    }
    const base64 = arrayBufferToBase64(await blob.arrayBuffer());
    console.log("🚀 Calling google-ocr...");
    const ocrRes = await fetch(`${SUPABASE_URL}/functions/v1/google-ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        ...OCR_KEY ? {
          "x-api-key": OCR_KEY
        } : {}
      },
      body: JSON.stringify({
        imageBase64: base64
      })
    });
    const ocrJson = await ocrRes.json().catch(async ()=>{
      const raw = await ocrRes.text();
      throw new Error("google-ocr returned non-JSON: " + raw);
    });
    if (!ocrRes.ok) throw new Error(ocrJson.error || `OCR failed (${ocrRes.status})`);
    const rawText = ocrJson.text ?? "";
    console.log("📄 Raw OCR text:", rawText);
    const cleanedZh = cleanChineseOcrText(rawText);
    console.log("🀄 Cleaned Chinese OCR:", cleanedZh);
    // Translate
    const transRes = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: rawText,
        source: "zh",
        target: "en",
        format: "text"
      })
    });
    const transJson = await transRes.json();
    const translated = transJson.data?.translations?.[0]?.translatedText ?? rawText;
    // Extract ingredients
// Extract ingredients section (English or Chinese)
const idxEn = translated.toLowerCase().indexOf("ingredients:");
const idxZh = cleanedZh.indexOf("成分") !== -1 || cleanedZh.indexOf("配料") !== -1;

let ingredients: string[] = [];

if (idxEn !== -1) {
  // Extract English ingredients
  const extracted = translated.substring(idxEn + "ingredients:".length).trim();
  ingredients = extracted.split(/,|;/).map(x => x.trim()).filter(Boolean);
} else if (idxZh) {
  // Rough fallback: try splitting Chinese ingredients
  const zhSection = cleanedZh.split(/成分[:：]|配料[:：]/)[1] || "";
  ingredients = zhSection.split(/,|，|；|、/).map(x => x.trim()).filter(Boolean);
}

// 🔎 Check if we actually got meaningful ingredients
if (ingredients.length === 0) {
  return new Response(JSON.stringify({
    productName: extractProductName(translated) || "Unknown Product",
    status: "Unclear Photo",
    reasoning: "❌ Could not detect any ingredient section. Please retake the photo showing the ingredient list clearly.",
    originalZh: cleanedZh
  }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}

console.log("🧪 Ingredients to check:", ingredients);


    // Product name
    const productName = extractProductName(translated);
    // DB
    const { data: highlights } = await supabase.from("ingredient_highlights").select("*");
    const { data: blacklist } = await supabase.from("ingredient_blacklist").select("*");
    console.log("🧪 DB highlights count:", highlights?.length);
    console.log("🧪 DB blacklist count:", blacklist?.length);
    if (blacklist) {
      for (const row of blacklist){
        try {
          const regex = new RegExp(row.pattern, "gi");
          ingredients = ingredients.filter((ing)=>!regex.test(ing));
        } catch (err) {
          console.warn("⚠️ Invalid blacklist regex:", row.pattern, err);
        }
      }
    }
    // Classification
    const rawMatches = [];
    if (highlights) {
      for (const ing of ingredients){
        for (const h of highlights){
          if (matchIngredient(ing, h.keyword) || h.keyword_zh && matchIngredient(ing, h.keyword_zh)) {
            console.log(`✅ MATCH: "${ing}" ↔ "${h.keyword}" [${h.color}]`);
            rawMatches.push({
              ing,
              keyword: h.keyword,
              color: h.color
            });
          }
        }
      }
    }
    const resolved = resolveConflicts(rawMatches);
    const matchedHaram = resolved.filter((m)=>m.color.includes("danger")).map((m)=>m.ing);
    const matchedSyubhah = resolved.filter((m)=>m.color.includes("warning")).map((m)=>m.ing);
    const matchedFriendly = resolved.filter((m)=>m.color.includes("primary")).map((m)=>m.ing);
    let status = "Muslim-friendly";
    let reasoning = "No Syubhah or Haram ingredients found";
    if (matchedHaram.length > 0) {
      status = "Haram";
      reasoning = formatReason("Detected haram ingredients", matchedHaram);
    } else if (matchedSyubhah.length > 0) {
      status = "Syubhah";
      reasoning = formatReason("Contains doubtful ingredients", matchedSyubhah);
    } else if (matchedFriendly.length > 0) {
      status = "Muslim-friendly";
      reasoning = formatReason("Safe Muslim-friendly ingredients", matchedFriendly);
    }
    return new Response(JSON.stringify({
      productName: productName || "Unknown Product",
      status,
      reasoning,
      originalZh: cleanedZh,
      matchedHaram,
      matchedSyubhah,
      matchedFriendly
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (err) {
    console.error("❌ Error in analyze-product:", err);
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
